import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

const COMPANY_ADMIN_EMAIL = "support@nestdesk.in";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.email !== COMPANY_ADMIN_EMAIL) {
    return {
      user: null,
      denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, denied: null };
}

const planCreateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).nullable(),
  monthlyPricePaise: z.number().int().min(0),
  yearlyPricePaise: z.number().int().min(0),
  maxProperties: z.number().int().min(1),
  maxTenants: z.number().int().min(1),
  baseFeeInr: z.number().int().min(0).default(100),
  propertyFeeInr: z.number().int().min(0).default(900),
  tenantFeeInr: z.number().int().min(0).default(7),
  tenantThreshold: z.number().int().min(0).default(150),
  pricingPropertyCount: z.number().int().min(0).nullable().optional(),
  pricingTenantCount: z.number().int().min(0).nullable().optional(),
  formulaVersion: z.string().min(1).max(30).default("v1"),
  isActive: z.boolean(),
});

const planIdSchema = z.object({
  planId: z.string().uuid(),
});

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("custom_institution_plans")
    .select(
      "id, name, description, monthly_price_paise, yearly_price_paise, max_properties, max_tenants, base_fee_inr, property_fee_inr, tenant_fee_inr, tenant_threshold, pricing_property_count, pricing_tenant_count, formula_version, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const planIds = (data ?? []).map((plan) => plan.id);
  const { data: assignments, error: assignmentError } = planIds.length
    ? await admin
        .from("owner_custom_institution_plans")
        .select("custom_plan_id")
        .in("custom_plan_id", planIds)
        .eq("is_active", true)
    : { data: [] as Array<{ custom_plan_id: string }>, error: null };

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }

  const accountCountByPlan = new Map<string, number>();
  (assignments ?? []).forEach((assignment) => {
    const current = accountCountByPlan.get(assignment.custom_plan_id) ?? 0;
    accountCountByPlan.set(assignment.custom_plan_id, current + 1);
  });

  const plansWithCounts = (data ?? []).map((plan) => ({
    ...plan,
    account_count: accountCountByPlan.get(plan.id) ?? 0,
  }));

  return NextResponse.json({ plans: plansWithCounts });
}

export async function POST(request: NextRequest) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: insertedPlan, error } = await admin
    .from("custom_institution_plans")
    .insert({
      name: parsed.data.name.trim(),
      description: parsed.data.description,
      monthly_price_paise: parsed.data.monthlyPricePaise,
      yearly_price_paise: parsed.data.yearlyPricePaise,
      max_properties: parsed.data.maxProperties,
      max_tenants: parsed.data.maxTenants,
      base_fee_inr: parsed.data.baseFeeInr,
      property_fee_inr: parsed.data.propertyFeeInr,
      tenant_fee_inr: parsed.data.tenantFeeInr,
      tenant_threshold: parsed.data.tenantThreshold,
      pricing_property_count: parsed.data.pricingPropertyCount ?? null,
      pricing_tenant_count: parsed.data.pricingTenantCount ?? null,
      formula_version: parsed.data.formulaVersion,
      is_active: parsed.data.isActive,
    })
    .select("id, name, is_active")
    .maybeSingle<{ id: string; name: string; is_active: boolean }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: null,
    user_id: user?.id ?? null,
    action: "admin_custom_plan_created",
    table_name: "custom_institution_plans",
    record_id: insertedPlan?.id ?? null,
    new_value: insertedPlan
      ? {
          id: insertedPlan.id,
          name: insertedPlan.name,
          is_active: insertedPlan.is_active,
        }
      : {
          name: parsed.data.name.trim(),
          is_active: parsed.data.isActive,
        },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsedId = planIdSchema.safeParse({
    planId: url.searchParams.get("planId"),
  });
  if (!parsedId.success) {
    return NextResponse.json(
      { error: parsedId.error.issues[0]?.message ?? "Invalid plan id." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existingPlan } = await admin
    .from("custom_institution_plans")
    .select("id, name, is_active")
    .eq("id", parsedId.data.planId)
    .maybeSingle<{ id: string; name: string; is_active: boolean }>();

  const { error } = await admin
    .from("custom_institution_plans")
    .update({
      name: parsed.data.name.trim(),
      description: parsed.data.description,
      monthly_price_paise: parsed.data.monthlyPricePaise,
      yearly_price_paise: parsed.data.yearlyPricePaise,
      max_properties: parsed.data.maxProperties,
      max_tenants: parsed.data.maxTenants,
      base_fee_inr: parsed.data.baseFeeInr,
      property_fee_inr: parsed.data.propertyFeeInr,
      tenant_fee_inr: parsed.data.tenantFeeInr,
      tenant_threshold: parsed.data.tenantThreshold,
      pricing_property_count: parsed.data.pricingPropertyCount ?? null,
      pricing_tenant_count: parsed.data.pricingTenantCount ?? null,
      formula_version: parsed.data.formulaVersion,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data.planId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nextPlanSnapshot = {
    id: parsedId.data.planId,
    name: parsed.data.name.trim(),
    is_active: parsed.data.isActive,
  };
  const statusChanged =
    existingPlan && existingPlan.is_active !== parsed.data.isActive;

  await admin.from("audit_logs").insert({
    owner_id: null,
    user_id: user?.id ?? null,
    action: statusChanged
      ? parsed.data.isActive
        ? "admin_custom_plan_activated"
        : "admin_custom_plan_deactivated"
      : "admin_custom_plan_updated",
    table_name: "custom_institution_plans",
    record_id: parsedId.data.planId,
    old_value: existingPlan
      ? {
          id: existingPlan.id,
          name: existingPlan.name,
          is_active: existingPlan.is_active,
        }
      : null,
    new_value: nextPlanSnapshot,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsedId = planIdSchema.safeParse({
    planId: url.searchParams.get("planId"),
  });
  if (!parsedId.success) {
    return NextResponse.json(
      { error: parsedId.error.issues[0]?.message ?? "Invalid plan id." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existingPlan } = await admin
    .from("custom_institution_plans")
    .select("id, name, is_active")
    .eq("id", parsedId.data.planId)
    .maybeSingle<{ id: string; name: string; is_active: boolean }>();

  const { error } = await admin
    .from("custom_institution_plans")
    .delete()
    .eq("id", parsedId.data.planId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: null,
    user_id: user?.id ?? null,
    action: "admin_custom_plan_deleted",
    table_name: "custom_institution_plans",
    record_id: parsedId.data.planId,
    old_value: existingPlan
      ? {
          id: existingPlan.id,
          name: existingPlan.name,
          is_active: existingPlan.is_active,
        }
      : { id: parsedId.data.planId },
  });

  return NextResponse.json({ success: true });
}
