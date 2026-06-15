import { NextResponse } from "next/server";
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

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const now = new Date();
  const monthStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { count: ownerCount },
    { count: ownerLast7d },
    { count: ownerLast30d },
    { count: activeHostelCount },
    { count: totalHostelCount },
    { count: activeTenantCount },
    { count: pendingTenantCount },
    { count: openMaintenanceCount },
    { count: leadLast7d },
    { count: leadLast30d },
    { count: totalLeadCount },
    { count: activeSubCount },
    { count: expiringSubCount },
    { count: disputedPaymentCount },
    { data: ownersForCredits },
    { data: ownersForPlan },
    { data: paymentsThisMonth },
    { data: recentLeads },
    { data: recentPayments },
    { data: recentOwners },
  ] = await Promise.all([
    admin.from("owners").select("*", { count: "exact", head: true }),
    admin
      .from("owners")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    admin
      .from("owners")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    admin
      .from("hostels")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    admin.from("hostels").select("*", { count: "exact", head: true }),
    admin
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    admin
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
    admin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null),
    admin
      .from("sales_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    admin
      .from("sales_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    admin.from("sales_leads").select("*", { count: "exact", head: true }),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .lte("ends_at", thirtyDaysFromNow)
      .gte("ends_at", now.toISOString()),
    admin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "disputed"),
    admin.from("owners").select("unused_credit_paise"),
    admin.from("owners").select("plan"),
    admin
      .from("payments")
      .select("amount, status")
      .gte("paid_on", monthStart)
      .lte("paid_on", monthEnd),
    admin
      .from("sales_leads")
      .select("contact_name, contact_email, institution_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("payments")
      .select("id, amount, status, method, paid_on, tenant_id, hostel_id")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("owners")
      .select("id, full_name, email, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const monthlyCollected = (paymentsThisMonth ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const monthlyPending = (paymentsThisMonth ?? [])
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const monthlyOverdue = (paymentsThisMonth ?? [])
    .filter((p) => p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalUnusedCreditPaise = (ownersForCredits ?? []).reduce(
    (sum, o) => sum + (o.unused_credit_paise ?? 0),
    0,
  );

  const planCounts: Record<string, number> = {};
  for (const o of ownersForPlan ?? []) {
    const plan = normalizeOwnerPlan(o.plan);
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  return NextResponse.json({
    owners: {
      total: ownerCount ?? 0,
      last7d: ownerLast7d ?? 0,
      last30d: ownerLast30d ?? 0,
    },
    hostels: {
      total: totalHostelCount ?? 0,
      active: activeHostelCount ?? 0,
    },
    tenants: {
      active: activeTenantCount ?? 0,
      pending: pendingTenantCount ?? 0,
    },
    payments: {
      monthlyCollected,
      monthlyPending,
      monthlyOverdue,
      disputed: disputedPaymentCount ?? 0,
      monthStart,
      monthEnd,
    },
    maintenance: {
      open: openMaintenanceCount ?? 0,
    },
    leads: {
      total: totalLeadCount ?? 0,
      last7d: leadLast7d ?? 0,
      last30d: leadLast30d ?? 0,
    },
    subscriptions: {
      active: activeSubCount ?? 0,
      expiringSoon: expiringSubCount ?? 0,
    },
    credits: {
      totalUnusedPaise: totalUnusedCreditPaise,
    },
    planDistribution: planCounts,
    recentLeads: recentLeads ?? [],
    recentPayments: recentPayments ?? [],
    recentOwners: recentOwners ?? [],
  });
}
