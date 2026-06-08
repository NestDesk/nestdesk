import Link from "next/link";
import { createAdminClient } from "../../lib/supabase/admin";
import { normalizeOwnerPlan } from "../../lib/subscriptions";
import { formatDateInIndia } from "../../lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  Wrench,
  IndianRupee,
  Coins,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "../../components/ui/button";

function fmt(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function fmtRupees(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  starter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  micro: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pro: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  institution: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  fresh: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  contacted: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  closed: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
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

  const [
    { count: ownerCount },
    { count: ownerLast7d },
    { count: activeHostelCount },
    { count: totalHostelCount },
    { count: activeTenantCount },
    { count: pendingTenantCount },
    { count: openMaintenanceCount },
    { count: leadLast7d },
    { count: leadLast30d },
    { count: activeSubCount },
    { count: disputedCount },
    { data: ownersForCredits },
    { data: ownersForPlan },
    { data: paymentsThisMonth },
    { data: recentLeads },
    { data: recentOwners },
  ] = await Promise.all([
    admin.from("owners").select("*", { count: "exact", head: true }),
    admin
      .from("owners")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
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
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
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
      .select(
        "contact_name, contact_email, institution_name, property_count, tenant_count, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("owners")
      .select("id, full_name, email, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const monthlyCollected = (paymentsThisMonth ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const monthlyOverdue = (paymentsThisMonth ?? [])
    .filter((p) => p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalUnusedCreditPaise = (ownersForCredits ?? []).reduce(
    (sum, o) => sum + (o.unused_credit_paise ?? 0),
    0,
  );

  const planCounts: Record<string, number> = {
    free: 0,
    starter: 0,
    micro: 0,
    pro: 0,
    institution: 0,
  };
  for (const o of ownersForPlan ?? []) {
    const plan = normalizeOwnerPlan(o.plan);
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const topKpis = [
    {
      label: "Total Accounts",
      value: String(ownerCount ?? 0),
      sub: `+${ownerLast7d ?? 0} this week`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active Properties",
      value: String(activeHostelCount ?? 0),
      sub: `${totalHostelCount ?? 0} total`,
      icon: Building2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active Tenants",
      value: String(activeTenantCount ?? 0),
      sub: `${pendingTenantCount ?? 0} pending`,
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: `Total Properties Payments — ${monthLabel}`,
      value: fmtRupees(monthlyCollected),
      sub:
        monthlyOverdue > 0
          ? `₹${monthlyOverdue.toLocaleString("en-IN")} overdue`
          : "No overdue",
      icon: IndianRupee,
      color: monthlyOverdue > 0 ? "text-amber-500" : "text-emerald-500",
      bg: monthlyOverdue > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      label: "Open Maintenance",
      value: String(openMaintenanceCount ?? 0),
      sub: "open / in progress",
      icon: Wrench,
      color:
        openMaintenanceCount && openMaintenanceCount > 0
          ? "text-amber-500"
          : "text-zinc-400",
      bg:
        openMaintenanceCount && openMaintenanceCount > 0
          ? "bg-amber-500/10"
          : "bg-zinc-500/10",
    },
    {
      label: "System Credits",
      value: fmt(totalUnusedCreditPaise),
      sub: "total unused balance",
      icon: Coins,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  const lowerKpis = [
    {
      label: "New Leads (7d)",
      value: String(leadLast7d ?? 0),
      sub: `${leadLast30d ?? 0} in 30 days`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active Subscriptions",
      value: String(activeSubCount ?? 0),
      sub: "paid plans active",
      icon: CreditCard,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Disputed Payments",
      value: String(disputedCount ?? 0),
      sub: "need review",
      icon: AlertCircle,
      color: disputedCount && disputedCount > 0 ? "text-red-500" : "text-zinc-400",
      bg: disputedCount && disputedCount > 0 ? "bg-red-500/10" : "bg-zinc-500/10",
    },
    {
      label: "New Signups (7d)",
      value: String(ownerLast7d ?? 0),
      sub: "new owner accounts",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/20">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            NestDesk Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Company Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot of the NestDesk platform across all accounts, properties,
            and tenants.
          </p>
        </div>
      </div>

      {/* Primary KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {topKpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/60 shadow-sm"
          >
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {lowerKpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/60 shadow-sm"
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-xl font-bold text-foreground">{value}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan distribution */}
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Plan Distribution
              </CardTitle>
              <Link href="/admin/owners">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  View owners <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            {Object.entries(planCounts).map(([plan, count]) => {
              const total = ownerCount ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={plan} className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-5 w-20 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-wide ${PLAN_COLORS[plan] ?? ""}`}
                  >
                    {plan}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-foreground">
                    {count}
                  </span>
                  <span className="w-8 text-right text-[11px] text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Leads</CardTitle>
              <Link href="/admin/leads">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  All leads <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pb-5">
            {(recentLeads ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No leads yet.
              </p>
            ) : (
              (recentLeads ?? []).map((lead, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {lead.contact_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.institution_name ?? lead.contact_email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${LEAD_STATUS_COLORS[lead.status] ?? ""}`}
                    >
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateInIndia(lead.created_at, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Owner Signups */}
        <Card className="rounded-2xl border border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Recent Owner Signups
              </CardTitle>
              <Link href="/admin/owners">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  All owners <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                      Plan
                    </th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(recentOwners ?? []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 text-center text-xs text-muted-foreground"
                      >
                        No owners yet.
                      </td>
                    </tr>
                  ) : (
                    (recentOwners ?? []).map((owner) => (
                      <tr key={owner.id} className="group">
                        <td className="py-2.5 font-medium text-foreground">
                          {owner.full_name}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {owner.email ?? "—"}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PLAN_COLORS[normalizeOwnerPlan(owner.plan)] ?? ""}`}
                          >
                            {normalizeOwnerPlan(owner.plan)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {formatDateInIndia(owner.created_at, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
