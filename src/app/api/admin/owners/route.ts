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

  const [{ data: hostelCounts }, { data: tenantCounts }] = await Promise.all([
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
  ]);

  const hostelsByOwner = new Map<string, number>();
  for (const h of hostelCounts ?? []) {
    hostelsByOwner.set(h.owner_id, (hostelsByOwner.get(h.owner_id) ?? 0) + 1);
  }

  const tenantsByOwner = new Map<string, number>();
  for (const t of tenantCounts ?? []) {
    tenantsByOwner.set(t.owner_id, (tenantsByOwner.get(t.owner_id) ?? 0) + 1);
  }

  const enriched = (owners ?? []).map((o) => ({
    id: o.id,
    full_name: o.full_name,
    email: o.email ?? null,
    phone: o.phone ?? null,
    plan: normalizeOwnerPlan(o.plan),
    unused_credit_paise: o.unused_credit_paise ?? 0,
    onboarding_completed: o.onboarding_completed,
    hostel_count: hostelsByOwner.get(o.id) ?? 0,
    active_tenant_count: tenantsByOwner.get(o.id) ?? 0,
    created_at: o.created_at,
  }));

  return NextResponse.json({ owners: enriched, total: count ?? 0 });
}
