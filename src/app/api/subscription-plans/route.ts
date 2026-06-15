import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getActivePlanCatalog } from "../../../lib/subscription-plans";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let ownerId: string | undefined;

  if (user?.id) {
    const ownerResult = await admin
      .from("owners")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    ownerId = ownerResult.data?.id ?? undefined;
  }

  const plans = await getActivePlanCatalog(admin, ownerId);

  let assignedCustomPlan = null;
  let assignedCustomPlanId: string | null = null;
  if (ownerId) {
    const { data: assignmentData } = await admin
      .from("owner_custom_institution_plans")
      .select("custom_plan_id")
      .eq("owner_id", ownerId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ custom_plan_id: string }>();

    assignedCustomPlanId = assignmentData?.custom_plan_id ?? null;

    if (assignedCustomPlanId) {
      const { data: customPlanData } = await admin
        .from("custom_institution_plans")
        .select("*")
        .eq("id", assignedCustomPlanId)
        .maybeSingle<Record<string, unknown>>();

      assignedCustomPlan = customPlanData ?? null;
    }
  }

  return NextResponse.json({ plans, assignedCustomPlan, assignedCustomPlanId });
}
