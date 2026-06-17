import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

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

const VALID_PLANS = ["free", "starter", "micro", "pro", "institution"];

export async function GET(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan")?.trim() ?? "";

  if (!plan) {
    return NextResponse.json({ error: "Missing plan" }, { status: 400 });
  }

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("subscriptions")
    .select(
      "id, owner_id, plan, custom_plan_id, status, starts_at, ends_at, created_at, owners!inner(full_name, email)",
    )
    .eq("plan", plan)
    .order("starts_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ownerIds = (subscriptions ?? []).map(
    (subscription) => subscription.owner_id,
  );
  const customPlanIds = Array.from(
    new Set(
      (subscriptions ?? [])
        .map((subscription) => subscription.custom_plan_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: hostels } = ownerIds.length
    ? await admin
        .from("hostels")
        .select("id, owner_id, name, city, state")
        .in("owner_id", ownerIds)
    : { data: [] };

  const { data: customPlans } = customPlanIds.length
    ? await admin
        .from("custom_institution_plans")
        .select("id, name")
        .in("id", customPlanIds)
    : { data: [] };

  const hostelsByOwner = new Map<
    string,
    Array<{ id: string; name: string; city: string | null; state: string | null }>
  >();
  for (const hostel of hostels ?? []) {
    if (!hostel.owner_id) continue;
    hostelsByOwner.set(hostel.owner_id, [
      ...(hostelsByOwner.get(hostel.owner_id) ?? []),
      {
        id: hostel.id,
        name: hostel.name,
        city: hostel.city,
        state: hostel.state,
      },
    ]);
  }

  const customPlanById = new Map(
    (customPlans ?? []).map((plan) => [plan.id, plan.name ?? null]),
  );

  const payload = {
    plan,
    subscriptions: (subscriptions ?? []).map((subscription) => ({
      id: subscription.id,
      owner_id: subscription.owner_id,
      plan: subscription.plan,
      custom_plan_id: subscription.custom_plan_id,
      custom_plan_name: subscription.custom_plan_id
        ? (customPlanById.get(subscription.custom_plan_id) ?? null)
        : null,
      status: subscription.status,
      starts_at: subscription.starts_at,
      ends_at: subscription.ends_at,
      created_at: subscription.created_at,
      owner: (() => {
        const owner = Array.isArray(subscription.owners)
          ? subscription.owners[0] ?? null
          : subscription.owners ?? null;

        return owner
          ? {
              id: subscription.owner_id,
              full_name: owner.full_name,
              email: owner.email,
            }
          : null;
      })(),
      hostels: hostelsByOwner.get(subscription.owner_id) ?? [],
    })),
  };

  return NextResponse.json(payload);
}
