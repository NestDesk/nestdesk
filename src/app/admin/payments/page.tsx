import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { CreditCard, AlertCircle, CheckCircle2, Clock } from "lucide-react";

function fmt(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank",
  razorpay: "Razorpay",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-400",
  disputed: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const [
    { data: allPaymentsThisMonth },
    { data: overduePayments },
    { data: disputedPayments },
    { data: recentPayments },
  ] = await Promise.all([
    admin
      .from("payments")
      .select("amount, status, method")
      .gte("paid_on", monthStart)
      .lte("paid_on", monthEnd),
    admin
      .from("payments")
      .select("id, amount, method, paid_on, notes, tenant_id, hostel_id, created_at")
      .eq("status", "overdue")
      .order("paid_on", { ascending: true })
      .limit(20),
    admin
      .from("payments")
      .select("id, amount, method, paid_on, notes, tenant_id, hostel_id, created_at")
      .eq("status", "disputed")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("payments")
      .select(
        "id, amount, status, method, paid_on, receipt_number, tenant_id, hostel_id, created_at, hostels!inner(name)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const collected = (allPaymentsThisMonth ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);

  const pending = (allPaymentsThisMonth ?? [])
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount), 0);

  const overdue = (allPaymentsThisMonth ?? [])
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + Number(p.amount), 0);

  const disputed = (allPaymentsThisMonth ?? [])
    .filter((p) => p.status === "disputed")
    .reduce((s, p) => s + Number(p.amount), 0);

  const methodCounts: Record<string, number> = {};
  for (const p of allPaymentsThisMonth ?? []) {
    if (p.method && p.status === "paid") {
      methodCounts[p.method] = (methodCounts[p.method] ?? 0) + 1;
    }
  }

  const summaryCards = [
    {
      label: "Collected",
      value: fmt(collected),
      sub: `${(allPaymentsThisMonth ?? []).filter((p) => p.status === "paid").length} payments`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Pending",
      value: fmt(pending),
      sub: `${(allPaymentsThisMonth ?? []).filter((p) => p.status === "pending").length} payments`,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Overdue",
      value: fmt(overdue),
      sub: `${(allPaymentsThisMonth ?? []).filter((p) => p.status === "overdue").length} payments`,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Disputed",
      value: fmt(disputed),
      sub: `${(allPaymentsThisMonth ?? []).filter((p) => p.status === "disputed").length} payments`,
      icon: AlertCircle,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10">
          <CreditCard className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Payment Health
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide payment activity for {monthLabel}.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment method breakdown */}
      {Object.keys(methodCounts).length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Payment Methods (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 pb-5">
            {Object.entries(methodCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([method, count]) => (
                <div
                  key={method}
                  className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {METHOD_LABELS[method] ?? method}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {count}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Payments */}
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Overdue Payments
              {(overduePayments ?? []).length > 0 && (
                <span className="ml-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                  {overduePayments?.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {(overduePayments ?? []).length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No overdue payments.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(overduePayments ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-red-500/5 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Hostel ID:{" "}
                        <span className="font-mono text-[10px]">
                          {p.hostel_id.slice(0, 8)}…
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due:{" "}
                        {formatDateInIndia(p.paid_on, {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {fmt(Number(p.amount))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.method ? (METHOD_LABELS[p.method] ?? p.method) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disputed Payments */}
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Disputed Payments
              {(disputedPayments ?? []).length > 0 && (
                <span className="ml-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  {disputedPayments?.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {(disputedPayments ?? []).length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No disputed payments.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(disputedPayments ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-orange-500/5 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Hostel:{" "}
                        <span className="font-mono text-[10px]">
                          {p.hostel_id.slice(0, 8)}…
                        </span>
                      </p>
                      {p.notes && (
                        <p className="max-w-36 truncate text-xs text-muted-foreground">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-orange-600 dark:text-orange-400">
                        {fmt(Number(p.amount))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateInIndia(p.created_at, {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent payments */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Recent Payments (All Properties)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Receipt
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(recentPayments ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {fmt(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[p.status] ?? ""}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {p.hostels?.[0]?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.method ? (METHOD_LABELS[p.method] ?? p.method) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.receipt_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatDateInIndia(p.paid_on, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
