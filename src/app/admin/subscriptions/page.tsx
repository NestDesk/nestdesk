import Link from "next/link";
import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import SubscriptionPlanDetailsClient from "../../../components/admin/SubscriptionPlanDetailsClient";
import { DateRangeFilter } from "../../../components/admin/DateRangeFilter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
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

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const admin = createAdminClient();
  const now = new Date();
  
  // Default to YTD
  const defaultStart = new Date(now.getFullYear(), 0, 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startStr = typeof searchParams?.start === "string" ? searchParams.start : toLocalISO(defaultStart);
  const endStr = typeof searchParams?.end === "string" ? searchParams.end : toLocalISO(defaultEnd);
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const rawPageSize = typeof searchParams?.pageSize === "string" ? Number(searchParams.pageSize) : 10;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = [5, 10, 25].includes(rawPageSize) ? rawPageSize : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const monthLabel = `${formatDateInIndia(startStr, { month: "short", year: "numeric", day: "numeric" })} - ${formatDateInIndia(endStr, { month: "short", year: "numeric", day: "numeric" })}`;

  const [
    activeSubscriptionCount,
    cancelledSubscriptionCount,
    expiredSubscriptionCount,
    newSubscriptionsThisMonthCount,
    razorpayPaymentsThisMonth,
    razorpayPaymentsAllTime,
    paymentsPage,
    allSubscriptionsForOwners,
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
      .gte("starts_at", startStr)
      .lte("starts_at", endStr),
    admin
      .from("payment_orders")
      .select("amount_paise, razorpay_payment_id")
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null)
      .gte("created_at", startStr)
      .lte("created_at", endStr),
    admin
      .from("payment_orders")
      .select("amount_paise, razorpay_payment_id")
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null),
    admin
      .from("payment_orders")
      .select(
        "id, owner_id, plan, amount_paise, receipt, razorpay_order_id, razorpay_payment_id, created_at, owners(full_name, email, phone)",
        { count: "exact" },
      )
      .eq("status", "paid")
      .not("razorpay_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to),
    admin
      .from("subscriptions")
      .select("id, owner_id, plan, status, starts_at, ends_at, created_at")
      .order("created_at", { ascending: false }),
    admin.from("subscriptions").select("plan, status"),
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
        owners: Array<{ full_name: string | null; email: string | null; phone: string | null }> | null;
      }> | null;
      count: number | null;
    },
    {
      data: Array<{
        id: string;
        owner_id: string | null;
        plan: string | null;
        status: string | null;
        starts_at: string | null;
        ends_at: string | null;
        created_at: string | null;
      }> | null;
    },
    { data: Array<{ plan: string | null; status: string | null }> | null },
  ];

  const totalActiveSubscriptions = activeSubscriptionCount?.count ?? 0;
  const totalCancelledSubscriptions = cancelledSubscriptionCount?.count ?? 0;
  const totalExpiredSubscriptions = expiredSubscriptionCount?.count ?? 0;
  const totalNewSubscriptionsThisMonth = newSubscriptionsThisMonthCount?.count ?? 0;

  const totalRazorpayRevenueThisMonth = (
    razorpayPaymentsThisMonth?.data ?? []
  ).reduce((sum, payment) => sum + Number(payment.amount_paise ?? 0), 0);
  const totalPaymentsCount = paymentsPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPaymentsCount / pageSize));
  const totalRazorpayRevenueAllTime = (razorpayPaymentsAllTime?.data ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount_paise ?? 0),
    0,
  );

  const subscriptionsByOwner = new Map<
    string,
    {
      id: string;
      owner_id: string | null;
      plan: string | null;
      status: string | null;
      starts_at: string | null;
      ends_at: string | null;
      created_at: string | null;
    }
  >();
  for (const subscription of allSubscriptionsForOwners?.data ?? []) {
    if (!subscription.owner_id) continue;
    if (!subscriptionsByOwner.has(subscription.owner_id)) {
      subscriptionsByOwner.set(subscription.owner_id, subscription);
    }
  }

  const planCounts: Record<
    string,
    { total: number; active: number; expired: number }
  > = {
    free: { total: 0, active: 0, expired: 0 },
    starter: { total: 0, active: 0, expired: 0 },
    micro: { total: 0, active: 0, expired: 0 },
    pro: { total: 0, active: 0, expired: 0 },
    institution: { total: 0, active: 0, expired: 0 },
  };

  for (const row of subscriptionsForPlanBreakdown?.data ?? []) {
    const plan = String(row.plan ?? "free");
    const status = String(row.status ?? "").toLowerCase();

    if (!planCounts[plan]) {
      planCounts[plan] = { total: 0, active: 0, expired: 0 };
    }

    planCounts[plan].total += 1;

    if (status === "active") {
      planCounts[plan].active += 1;
    }

    if (status === "expired") {
      planCounts[plan].expired += 1;
    }
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
      label: "Revenue in period",
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
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm sm:p-6 xl:flex-row xl:items-center xl:justify-between">
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
        <div className="flex flex-col items-end gap-3">
          <div className="rounded-2xl border border-border/70 bg-muted/50 p-2 text-sm font-medium text-foreground px-4">
            {monthLabel}
          </div>
          <DateRangeFilter defaultStart={toLocalISO(defaultStart)} defaultEnd={toLocalISO(defaultEnd)} />
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
          <CardContent className="pb-5">
            <SubscriptionPlanDetailsClient planCounts={planCounts} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenue snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Selected Period
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
                New subscriptions in period
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Razorpay subscription payments
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing {totalPaymentsCount} paid Razorpay subscription payments across all pages.
              </p>
            </div>
            <form method="GET" className="flex items-center gap-2">
              <input type="hidden" name="start" value={startStr} />
              <input type="hidden" name="end" value={endStr} />
              <input type="hidden" name="page" value="1" />
              <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground" htmlFor="pageSize">Rows</label>
              <select
                id="pageSize"
                name="pageSize"
                defaultValue={pageSize}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </select>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent"
              >
                Apply
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden rounded-2xl border border-border/60">
          <div className="hidden gap-0 text-xs uppercase text-muted-foreground p-4 sm:grid sm:grid-cols-[1fr_1.4fr_1fr_1fr_1fr]">
            <span className="font-semibold">Plan</span>
            <span className="font-semibold">Account</span>
            <span className="font-semibold">Amount</span>
            <span className="font-semibold">Bought on</span>
            <span className="font-semibold">Status</span>
          </div>
          <div className="divide-y divide-border/60">
            {(paymentsPage?.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No Razorpay subscription payments found.
              </div>
            ) : (
              (paymentsPage?.data ?? []).map((payment) => {
                const owner = Array.isArray(payment.owners) ? payment.owners[0] : null;
                const subscription = payment.owner_id
                  ? subscriptionsByOwner.get(payment.owner_id)
                  : null;

                return (
                  <div
                    key={payment.id}
                    className="grid gap-3 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-[1fr_1.4fr_1fr_1fr_1fr]"
                  >
                    <div className="min-w-0 text-foreground">
                      <div className="truncate font-medium">{payment.plan ?? "—"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Receipt ID: {payment.razorpay_payment_id ?? "—"}</div>
                    </div>
                    <div className="min-w-0 text-muted-foreground">
                      <div className="truncate font-medium text-foreground">
                        {owner?.full_name ?? "Owner details unavailable"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {owner?.phone ?? "No mobile number on file"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {owner?.email ?? "No email on file"}
                      </div>
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
                    <div className="text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {subscription?.status ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-border/60 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-center text-xs text-muted-foreground md:text-left">
              Page {page} of {totalPages} • {pageSize} rows per page
            </p>
            <div className="flex flex-wrap justify-center items-center gap-2">
              <Link
                href={`?start=${startStr}&end=${endStr}&page=${Math.max(1, page - 1)}&pageSize=${pageSize}`}
                className={`inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                Previous
              </Link>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={`?start=${startStr}&end=${endStr}&page=${pageNumber}&pageSize=${pageSize}`}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium ${pageNumber === page ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-accent"}`}
                >
                  {pageNumber}
                </Link>
              ))}
              <Link
                href={`?start=${startStr}&end=${endStr}&page=${Math.min(totalPages, page + 1)}&pageSize=${pageSize}`}
                className={`inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
