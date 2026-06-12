import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanConfig,
  getPlanDisplayConfig,
  type OwnerPlan,
  type PlanDisplayConfig,
} from "./subscriptions";
import { getOwnerActiveCustomInstitutionPlan } from "./custom-institution-plans";
import type { CustomInstitutionPlanRecord } from "./custom-institution-plans";

type SubscriptionPlanRow = {
  code: string;
  name: string | null;
  description: string | null;
  monthly_price_paise: number | null;
  max_properties: number | null;
  max_tenants: number | null;
  is_custom: boolean | null;
  rank: number | null;
};

type PlanLimits = {
  maxProperties: number;
  maxTenants: number;
};

const PLAN_CODE_SET = new Set(["free", "micro", "starter", "pro", "institution"]);

function toOwnerPlan(code: string): OwnerPlan | null {
  return PLAN_CODE_SET.has(code) ? (code as OwnerPlan) : null;
}

function fallbackPlanCatalog(): PlanDisplayConfig[] {
  return [
    getPlanDisplayConfig("free"),
    getPlanDisplayConfig("starter"),
    getPlanDisplayConfig("micro"),
    getPlanDisplayConfig("pro"),
    getPlanDisplayConfig("institution"),
  ];
}

export async function getActivePlanCatalog(
  admin: SupabaseClient,
  ownerId?: string,
): Promise<PlanDisplayConfig[]> {
  const [{ data, error }, ownerAssignment] = await Promise.all([
    admin
      .from("subscription_plans")
      .select(
        "code, name, description, monthly_price_paise, max_properties, max_tenants, is_custom, rank",
      )
      .eq("is_active", true)
      .order("rank", { ascending: true }),
    ownerId
      ? admin
          .from("owner_custom_institution_plans")
          .select("custom_institution_plans!inner(*)")
          .eq("owner_id", ownerId)
          .eq("is_active", true)
          .eq("custom_institution_plans.is_active", true)
          .limit(1)
          .maybeSingle<{
            custom_institution_plans: CustomInstitutionPlanRecord;
          }>()
      : Promise.resolve({ data: null, error: null }),
  ] as const);

  const activeAssignedPlan = ownerAssignment?.data
    ? (
        ownerAssignment.data as {
          custom_institution_plans: CustomInstitutionPlanRecord;
        }
      ).custom_institution_plans
    : null;

  const basePlans = fallbackPlanCatalog();
  if (error || !data || data.length === 0) {
    const plans = activeAssignedPlan
      ? [
          ...basePlans,
          {
            ...getPlanDisplayConfig("institution"),
            name: activeAssignedPlan.name,
            description:
              activeAssignedPlan.description ||
              getPlanDisplayConfig("institution").description,
            amountPaise: activeAssignedPlan.monthly_price_paise,
            isCustom: true,
            customPlanId: activeAssignedPlan.id,
            maxProperties: activeAssignedPlan.max_properties,
            maxTenants: activeAssignedPlan.max_tenants,
            features: getPlanDisplayConfig("institution").features,
            ctaLabel: getPlanDisplayConfig("institution").ctaLabel,
            ctaHref: getPlanDisplayConfig("institution").ctaHref,
            highlighted: getPlanDisplayConfig("institution").highlighted,
          },
        ]
      : basePlans;

    if (activeAssignedPlan) {
      const freeIndex = plans.findIndex((plan) => plan.id === "free");
      if (freeIndex >= 0) {
        const assignedPlan = plans.pop();
        if (assignedPlan) {
          plans.splice(freeIndex + 1, 0, assignedPlan);
        }
      }
    }

    return plans;
  }

  const planRecords: Array<PlanDisplayConfig | null> = (
    data as SubscriptionPlanRow[]
  ).map((row) => {
    const plan = toOwnerPlan(row.code);
    if (!plan) return null;

    const fallback = getPlanDisplayConfig(plan);

    return {
      ...fallback,
      name: row.name?.trim() || fallback.name,
      description: row.description?.trim() || fallback.description,
      amountPaise: row.monthly_price_paise ?? fallback.amountPaise,
      isCustom: row.is_custom ?? fallback.isCustom,
      customPlanId: undefined,
      features: fallback.features,
      ctaLabel: fallback.ctaLabel,
      ctaHref: fallback.ctaHref,
      highlighted: fallback.highlighted,
    };
  });

  const resolvedPlans = planRecords.filter(
    (plan): plan is PlanDisplayConfig => plan !== null,
  );

  if (!activeAssignedPlan) {
    return resolvedPlans;
  }

  const assignedPlan: PlanDisplayConfig = {
    ...getPlanDisplayConfig("institution"),
    name: activeAssignedPlan.name,
    description:
      activeAssignedPlan.description ||
      getPlanDisplayConfig("institution").description,
    amountPaise: activeAssignedPlan.monthly_price_paise,
    isCustom: true,
    customPlanId: activeAssignedPlan.id,
    maxProperties: activeAssignedPlan.max_properties,
    maxTenants: activeAssignedPlan.max_tenants,
    features: getPlanDisplayConfig("institution").features,
    ctaLabel: getPlanDisplayConfig("institution").ctaLabel,
    ctaHref: getPlanDisplayConfig("institution").ctaHref,
    highlighted: getPlanDisplayConfig("institution").highlighted,
  };

  const freeIndex = resolvedPlans.findIndex((plan) => plan.id === "free");
  if (freeIndex >= 0) {
    resolvedPlans.splice(freeIndex + 1, 0, assignedPlan);
    return resolvedPlans;
  }

  return [...resolvedPlans, assignedPlan];
}

export async function getPlanLimitsForOwner(
  admin: SupabaseClient,
  plan: OwnerPlan,
  ownerId: string,
): Promise<PlanLimits> {
  const fallback = getPlanConfig(plan);
  const fallbackLimits = {
    maxProperties: fallback.maxProperties,
    maxTenants: fallback.maxTenants,
  };

  if (plan === "institution") {
    const customPlan = await getOwnerActiveCustomInstitutionPlan(admin, ownerId);
    if (customPlan) {
      return {
        maxProperties: customPlan.max_properties,
        maxTenants: customPlan.max_tenants,
      };
    }
  }

  const { data: globalPlan, error: globalPlanError } = await admin
    .from("subscription_plans")
    .select("max_properties, max_tenants")
    .eq("code", plan)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ max_properties: number | null; max_tenants: number | null }>();

  if (globalPlanError || !globalPlan) {
    return fallbackLimits;
  }

  return {
    maxProperties: globalPlan.max_properties ?? fallbackLimits.maxProperties,
    maxTenants: globalPlan.max_tenants ?? fallbackLimits.maxTenants,
  };
}
