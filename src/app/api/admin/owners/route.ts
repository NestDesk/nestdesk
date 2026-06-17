import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { normalizeOwnerPlan } from "../../../../lib/subscriptions";

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

export async function GET(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  let query = admin
    .from("owners")
    .select(
      "id, user_id, full_name, email, phone, plan, unused_credit_paise, onboarding_completed, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: owners, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ownerIds = (owners ?? []).map((o) => o.id);

  const [{ data: hostelCounts }, { data: tenantCounts }, { data: subscriptions }] =
    await Promise.all([
      ownerIds.length > 0
        ? admin.from("hostels").select("owner_id").in("owner_id", ownerIds)
        : Promise.resolve({ data: [] }),
      ownerIds.length > 0
        ? admin
            .from("tenants")
            .select("owner_id")
            .eq("status", "active")
            .in("owner_id", ownerIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
      ownerIds.length > 0
        ? admin
            .from("subscriptions")
            .select("owner_id, plan, status, starts_at, ends_at, custom_plan_id")
            .in("owner_id", ownerIds)
            .in("status", ["active", "grace_period"])
            .order("starts_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const subscriptionsByOwner = new Map<string, {
    plan: string | null;
    status: string | null;
    starts_at: string | null;
    ends_at: string | null;
    custom_plan_id: string | null;
  }>();

  for (const row of subscriptions ?? []) {
    if (!row.owner_id) continue;
    if (!subscriptionsByOwner.has(row.owner_id)) {
      subscriptionsByOwner.set(row.owner_id, row);
    }
  }

  const customPlanIds = Array.from(
    new Set(
      (subscriptions ?? [])
        .map((row) => row.custom_plan_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: customPlans } = customPlanIds.length
    ? await admin
        .from("custom_institution_plans")
        .select("id, name")
        .in("id", customPlanIds)
    : { data: [] as Array<{ id: string; name: string | null }> };

  const customPlanNamesById = new Map(
    (customPlans ?? []).map((plan) => [plan.id, plan.name ?? null]),
  );

  const hostelsByOwner = new Map<string, number>();
  for (const h of hostelCounts ?? []) {
    hostelsByOwner.set(h.owner_id, (hostelsByOwner.get(h.owner_id) ?? 0) + 1);
  }

  const tenantsByOwner = new Map<string, number>();
  for (const t of tenantCounts ?? []) {
    tenantsByOwner.set(t.owner_id, (tenantsByOwner.get(t.owner_id) ?? 0) + 1);
  }

  const enriched = (owners ?? []).map((o) => {
    const subscription = subscriptionsByOwner.get(o.id);
    const customPlanName = subscription?.custom_plan_id
      ? customPlanNamesById.get(subscription.custom_plan_id) ?? null
      : null;

    return {
      id: o.id,
      full_name: o.full_name,
      email: o.email ?? null,
      phone: o.phone ?? null,
      plan: normalizeOwnerPlan(o.plan),
      plan_label: subscription?.plan ? String(subscription.plan) : normalizeOwnerPlan(o.plan),
      custom_plan_name: customPlanName,
      subscription_starts_at: subscription?.starts_at ?? null,
      subscription_ends_at: subscription?.ends_at ?? null,
      unused_credit_paise: o.unused_credit_paise ?? 0,
      onboarding_completed: o.onboarding_completed,
      hostel_count: hostelsByOwner.get(o.id) ?? 0,
      active_tenant_count: tenantsByOwner.get(o.id) ?? 0,
      created_at: o.created_at,
    };
  });

  return NextResponse.json({ owners: enriched, total: count ?? 0 });
}
