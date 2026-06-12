import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerPlan } from "./subscriptions";

export type CustomInstitutionPlanRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price_paise: number;
  yearly_price_paise: number;
  max_properties: number;
  max_tenants: number;
  base_fee_inr: number;
  property_fee_inr: number;
  tenant_fee_inr: number;
  tenant_threshold: number;
  pricing_property_count: number | null;
  pricing_tenant_count: number | null;
  formula_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomPlanFormulaInput = {
  propertyCount: number;
  tenantCount: number;
  baseFeeInr: number;
  propertyFeeInr: number;
  tenantFeeInr: number;
  tenantThreshold: number;
};

export type CustomPlanCalculatedPrice = {
  monthlyPricePaise: number;
  yearlyPricePaise: number;
};

function normalizeNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function calculateCustomPlanPrice(
  input: CustomPlanFormulaInput,
): CustomPlanCalculatedPrice {
  const propertyCount = normalizeNonNegative(input.propertyCount);
  const tenantCount = normalizeNonNegative(input.tenantCount);
  const baseFeeInr = normalizeNonNegative(input.baseFeeInr);
  const propertyFeeInr = normalizeNonNegative(input.propertyFeeInr);
  const tenantFeeInr = normalizeNonNegative(input.tenantFeeInr);
  const tenantThreshold = normalizeNonNegative(input.tenantThreshold);

  const overageTenants = Math.max(0, tenantCount - tenantThreshold);
  const monthlyInr =
    baseFeeInr + propertyFeeInr * propertyCount + tenantFeeInr * overageTenants;

  const monthlyPricePaise = monthlyInr * 100;
  const yearlyPricePaise = monthlyPricePaise * 12;

  return {
    monthlyPricePaise,
    yearlyPricePaise,
  };
}

export type OwnerCustomInstitutionPlanRecord = {
  id: string;
  owner_id: string;
  custom_plan_id: string;
  is_active: boolean;
  assigned_at: string;
  updated_at: string;
};

export type CustomPlanUsage = {
  plan: CustomInstitutionPlanRecord;
  assignment: OwnerCustomInstitutionPlanRecord | null;
};

export async function listActiveCustomInstitutionPlans(
  admin: SupabaseClient,
): Promise<CustomInstitutionPlanRecord[]> {
  const { data, error } = await admin
    .from("custom_institution_plans")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as CustomInstitutionPlanRecord[];
}

export async function getOwnerActiveCustomInstitutionPlan(
  admin: SupabaseClient,
  ownerId: string,
): Promise<CustomInstitutionPlanRecord | null> {
  const { data, error } = await admin
    .from("owner_custom_institution_plans")
    .select("custom_institution_plans!inner(*)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .eq("custom_institution_plans.is_active", true)
    .limit(1)
    .maybeSingle<{
      custom_institution_plans: CustomInstitutionPlanRecord;
    }>();

  if (error || !data) {
    return null;
  }

  return data.custom_institution_plans;
}

export async function getCustomInstitutionPlanById(
  admin: SupabaseClient,
  customPlanId: string,
): Promise<CustomInstitutionPlanRecord | null> {
  const { data, error } = await admin
    .from("custom_institution_plans")
    .select("*")
    .eq("id", customPlanId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CustomInstitutionPlanRecord;
}

export async function getPlanLimitsForCustomAssignment(
  admin: SupabaseClient,
  ownerId: string,
): Promise<{ maxProperties: number; maxTenants: number } | null> {
  const plan = await getOwnerActiveCustomInstitutionPlan(admin, ownerId);
  if (!plan) return null;

  return {
    maxProperties: plan.max_properties,
    maxTenants: plan.max_tenants,
  };
}

export function normalizeCustomInstitutionPlanToOwnerPlan(
  planCode: string,
): OwnerPlan {
  return planCode === "institution" ? "institution" : "institution";
}
