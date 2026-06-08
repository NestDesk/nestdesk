import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { CreditCard, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

function fmtRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function toLocalISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const [
    activeSubscriptionCount,
    cancelledSubscriptionCount,
    expiredSubscriptionCount,
    newSubscriptionsThisMonthCount,
    razorpayPaymentsThisMonth,
    razorpayPaymentsAllTime,
    recentPayments,
    subscriptionsForPlanBreakdown,
  ] = (await Promise.all([
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd),
    admin
      .from("payment_orders")
      .select("amount_paise, razorpay_payment_id")
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    admin
      .from("payment_orders")
      .select("amount_paise, razorpay_payment_id")
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null),
    admin
      .from("payment_orders")
      .select(
        "id, owner_id, plan, amount_paise, receipt, razorpay_order_id, razorpay_payment_id, created_at",
      )
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
    admin.from("subscriptions").select("plan"),
  ])) as [
    { count: number | null },
    { count: number | null },
    { count: number | null },
    { count: number | null },
    {
      data: Array<{
        amount_paise: number | null;
        razorpay_payment_id: string | null;
      }> | null;
    },
    {
      data: Array<{
        amount_paise: number | null;
        razorpay_payment_id: string | null;
      }> | null;
    },
    {
      data: Array<{
        id: string;
        owner_id: string | null;
        plan: string | null;
        amount_paise: number | null;
        receipt: string | null;
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        created_at: string | null;
      }> | null;
    },
    { data: Array<{ plan: string | null }> | null },
  ];

  const totalActiveSubscriptions = activeSubscriptionCount?.count ?? 0;
  const totalCancelledSubscriptions = cancelledSubscriptionCount?.count ?? 0;
  const totalExpiredSubscriptions = expiredSubscriptionCount?.count ?? 0;
  const totalNewSubscriptionsThisMonth = newSubscriptionsThisMonthCount?.count ?? 0;

  const totalRazorpayRevenueThisMonth = (
    razorpayPaymentsThisMonth?.data ?? []
  ).reduce((sum, payment) => sum + Number(payment.amount_paise ?? 0), 0);
  const totalRazorpayRevenueAllTime = (razorpayPaymentsAllTime?.data ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount_paise ?? 0),
    0,
  );

  const planCounts: Record<string, number> = {
    free: 0,
    starter: 0,
    micro: 0,
    pro: 0,
    institution: 0,
  };

  for (const row of subscriptionsForPlanBreakdown?.data ?? []) {
    const plan = String(row.plan ?? "free");
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  const summaryCards = [
    {
      label: "Active subscriptions",
      value: String(totalActiveSubscriptions),
      sub: "Current paid plans",
      icon: CreditCard,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Revenue this month",
      value: fmtRupees(totalRazorpayRevenueThisMonth),
      sub: `${totalNewSubscriptionsThisMonth} new subscriptions`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Actual Razorpay receipts",
      value: fmtRupees(totalRazorpayRevenueAllTime),
      sub: `${razorpayPaymentsAllTime?.data?.length ?? 0} payments total`,
      icon: CheckCircle2,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Cancellations / expired",
      value: `${totalCancelledSubscriptions + totalExpiredSubscriptions}`,
      sub: `${totalCancelledSubscriptions} cancelled, ${totalExpiredSubscriptions} expired`,
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Subscription performance
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Admin Subscriptions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review plan activity, Razorpay subscription revenue, and recent payment
            receipts across the platform.
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
          {monthLabel}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/60 shadow-sm"
          >
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Subscriptions by plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            {Object.entries(planCounts).map(([plan, count]) => (
              <div
                key={plan}
                className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{plan}</p>
                  <p className="text-sm text-muted-foreground">
                    {count} subscriptions
                  </p>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenue snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                This month
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {fmtRupees(totalRazorpayRevenueThisMonth)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                All time actual payments
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {fmtRupees(totalRazorpayRevenueAllTime)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                New subscriptions this month
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {totalNewSubscriptionsThisMonth}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Recent Razorpay subscription payments
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-2xl border border-border/60">
          <div className="grid gap-0 text-xs uppercase text-muted-foreground sm:grid-cols-[2fr_1fr_1fr_1fr] p-4">
            <span className="font-semibold">Plan</span>
            <span className="font-semibold">Amount</span>
            <span className="font-semibold">Date</span>
            <span className="font-semibold">Receipt</span>
          </div>
          <div className="divide-y divide-border/60">
            {(recentPayments?.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No Razorpay subscription payments found.
              </div>
            ) : (
              (recentPayments?.data ?? []).map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-0 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr]"
                >
                  <div className="min-w-0 truncate text-foreground">
                    {payment.plan}
                  </div>
                  <div className="text-muted-foreground">
                    {fmtRupees(Number(payment.amount_paise ?? 0))}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDateInIndia(payment.created_at, {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className="min-w-0 truncate text-muted-foreground">
                    {payment.receipt ?? payment.razorpay_payment_id ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
