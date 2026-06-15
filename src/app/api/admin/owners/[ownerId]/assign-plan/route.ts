import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

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

const assignPlanSchema = z.object({
  customPlanId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { ownerId: string } },
) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  const parsedOwnerId = z.string().uuid().safeParse(params.ownerId);
  if (!parsedOwnerId.success) {
    return NextResponse.json({ error: "Invalid owner id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = assignPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id, email, full_name")
    .eq("id", parsedOwnerId.data)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner not found." }, { status: 404 });
  }

  const { data: plan, error: planError } = await admin
    .from("custom_institution_plans")
    .select("id, name")
    .eq("id", parsed.data.customPlanId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json(
      { error: "Custom plan not found or not active." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();

  const { data: previousAssignment } = await admin
    .from("owner_custom_institution_plans")
    .select("custom_plan_id, custom_institution_plans(name)")
    .eq("owner_id", parsedOwnerId.data)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{
      custom_plan_id: string;
      custom_institution_plans: { name: string | null };
    }>();

  const { error: deactivateError } = await admin
    .from("owner_custom_institution_plans")
    .update({ is_active: false, updated_at: now })
    .eq("owner_id", parsedOwnerId.data)
    .eq("is_active", true);

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  const { error: insertError } = await admin
    .from("owner_custom_institution_plans")
    .insert({
      owner_id: parsedOwnerId.data,
      custom_plan_id: parsed.data.customPlanId,
      is_active: true,
      assigned_at: now,
      updated_at: now,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: parsedOwnerId.data,
    user_id: user?.id ?? null,
    action: "admin_custom_plan_assigned",
    table_name: "owner_custom_institution_plans",
    old_value: previousAssignment
      ? {
          custom_plan_id: previousAssignment.custom_plan_id,
          custom_plan_name:
            previousAssignment.custom_institution_plans?.name ?? null,
        }
      : null,
    new_value: {
      owner_id: parsedOwnerId.data,
      owner_email: owner.email ?? null,
      owner_name: owner.full_name,
      custom_plan_id: plan.id,
      custom_plan_name: plan.name,
      assigned_at: now,
    },
  });

  return NextResponse.json({ success: true });
}
