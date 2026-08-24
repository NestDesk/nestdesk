import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  Building2,
  CreditCard,
  TrendingUp,
  ArrowRight,
  MapPin,
  AlertCircle,
  Wrench,
  Phone,
  IndianRupee,
} from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  formatPlanLabel,
  getEffectivePlan,
  isSubscriptionCurrent,
  normalizeOwnerPlan,
} from "../../../lib/subscriptions";

function formatDateToLocalISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

type OccupancySummary = {
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  maintenanceRooms: number;
  inactiveRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
};

type HostelOccupancyRow = {
  id: string;
  name: string;
  totalRooms: number;
  occupiedRooms: number;
  totalBeds: number;
  occupiedBeds: number;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch owner's properties with floor counts
  let setupRequired = false;
  let setupProperty: { id: string; name: string } | null = null;
  let hasProperties = false;
  let isPhoneVerified = false;
  let activeCount = 0;
  let inactiveCount = 0;
  let openMaintenanceCount = 0;
  let thisMonthExpenseTotal = 0;
  let thisMonthRentPaid = 0;
  let activeTenantsCount = 0;
  let thisMonthRevenueExpected = 0;
  let currentPlan = "free";
  let subscriptionStatus = "free";
  let subscriptionEndsAt: string | null = null;
  let subscriptionStatusLabel = "Active";
  let previousPlanExpiredNote: string | null = null;
  const occupancySummary: OccupancySummary = {
    totalRooms: 0,
    occupiedRooms: 0,
    vacantRooms: 0,
    maintenanceRooms: 0,
    inactiveRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
  };
  let hostelOccupancy: HostelOccupancyRow[] = [];
  const now = new Date();
  const monthStart = formatDateToLocalISO(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const monthEnd = formatDateToLocalISO(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );
  const nextMonthStart = formatDateToLocalISO(
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  );
  const currentMonthRangeLabel = `${formatDateInIndia(monthStart, {
    day: "2-digit",
    month: "short",
  })} – ${formatDateInIndia(monthEnd, {
    day: "2-digit",
    month: "short",
  })}`;

  if (user) {
    const { data: owner } = await admin
      .from("owners")
      .select("id, plan, phone_verified")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; plan: string; phone_verified: boolean }>();

    if (owner) {
      const [subscriptionResult, hostelsResult] = await Promise.all([
        admin
          .from("subscriptions")
          .select("plan, status, ends_at")
          .eq("owner_id", owner.id)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("hostels")
          .select("id, name, is_active")
          .eq("owner_id", owner.id)
          .order("created_at", { ascending: true }),
      ]);

      const currentSubscription = subscriptionResult.data;

      currentPlan = currentSubscription
        ? getEffectivePlan(currentSubscription)
        : normalizeOwnerPlan(owner.plan);
      isPhoneVerified = owner.phone_verified;

      if (currentSubscription) {
        const subscriptionPlan = normalizeOwnerPlan(currentSubscription.plan);
        subscriptionStatus = isSubscriptionCurrent(currentSubscription)
          ? currentSubscription.status
          : "expired";
        subscriptionEndsAt = currentSubscription.ends_at;

        if (subscriptionStatus === "expired" && currentPlan === "free") {
          subscriptionStatusLabel = "Active";
          if (subscriptionPlan !== "free") {
            previousPlanExpiredNote = `${formatPlanLabel(subscriptionPlan)} expired on ${formatDateInIndia(
              currentSubscription.ends_at ?? new Date().toISOString(),
              { day: "2-digit", month: "short", year: "numeric" },
            )}. Downgraded to Free Plan.`;
          }
        } else {
          subscriptionStatusLabel =
            subscriptionStatus === "free" ? "Active" : subscriptionStatus;
        }
      } else {
        subscriptionStatusLabel =
          currentPlan === "free" ? "Active" : subscriptionStatus;
      }

      const { data: hostels, error: hostelsError } = hostelsResult;

      if (hostelsError) {
        console.error("[dashboard] failed to load owner hostels", hostelsError);
      }

      if (hostels && hostels.length > 0) {
        hasProperties = true;
        activeCount = hostels.filter((h) => h.is_active).length;
        inactiveCount = hostels.filter((h) => !h.is_active).length;

        // Check if there's any property without floors set up
        const firstHostel = hostels[0];
        const { count: floorCount } = await admin
          .from("floors")
          .select("id", { count: "exact", head: true })
          .eq("hostel_id", firstHostel.id)
          .is("deleted_at", null);

        if (!floorCount || floorCount === 0) {
          setupRequired = true;
          setupProperty = { id: firstHostel.id, name: firstHostel.name };
        }

        const hostelIds = hostels.map((h) => h.id);
        if (hostelIds.length > 0) {
          const [roomsResult, tenantsResult] = await Promise.all([
            admin
              .from("rooms")
              .select("id, hostel_id, capacity, rent_amount, status")
              .in("hostel_id", hostelIds)
              .is("deleted_at", null),
            admin
              .from("tenants")
              .select(
                "id, hostel_id, room_id, status, created_at, agreed_rent_amount, join_date, rent_start_date, move_out_date",
              )
              .in("hostel_id", hostelIds)
              .is("deleted_at", null),
          ]);

          const { data: rooms, error: roomsError } = roomsResult;
          const { data: tenants, error: tenantsError } = tenantsResult;

          if (roomsError) {
            console.error(
              "[dashboard] failed to load rooms for occupancy",
              roomsError,
            );
          }

          if (tenantsError) {
            console.error(
              "[dashboard] failed to load tenants for occupancy",
              tenantsError,
            );
          }

          const activeTenants = (tenants ?? []).filter(
            (tenant) => tenant.status === "active",
          );
          activeTenantsCount = activeTenants.length;

          // KPI definitions:
          // - Rent Collected = sum of payment rows with status "paid" in the current month.
          // - Expected Rent = current-month paid receipts plus the agreed rent for tenants
          //   whose latest paid billing_end does not cover the current month.
          const roomRentById = new Map<string, number>();
          for (const room of rooms ?? []) {
            roomRentById.set(room.id, Number(room.rent_amount) || 0);
          }

          const tenantCountByRoom = new Map<string, number>();
          for (const tenant of activeTenants ?? []) {
            if (!tenant.room_id) continue;
            tenantCountByRoom.set(
              tenant.room_id,
              (tenantCountByRoom.get(tenant.room_id) ?? 0) + 1,
            );
          }

          const byHostel = new Map<string, HostelOccupancyRow>();
          for (const hostel of hostels) {
            byHostel.set(hostel.id, {
              id: hostel.id,
              name: hostel.name,
              totalRooms: 0,
              occupiedRooms: 0,
              totalBeds: 0,
              occupiedBeds: 0,
            });
          }

          for (const room of rooms ?? []) {
            const roomCapacity = Number(room.capacity) || 0;
            const activeInRoom = tenantCountByRoom.get(room.id) ?? 0;
            const occupiedBedsInRoom = Math.min(activeInRoom, roomCapacity);
            const roomIsOccupied =
              activeInRoom > 0 ||
              room.status === "occupied" ||
              room.status === "occupied_partial";
            const roomIsInactive = room.status === "inactive";
            const roomIsMaintenance = room.status === "maintenance";

            occupancySummary.totalRooms += 1;

            if (roomIsInactive) {
              occupancySummary.inactiveRooms += 1;
            } else if (roomIsMaintenance) {
              occupancySummary.maintenanceRooms += 1;
            } else if (roomIsOccupied) {
              occupancySummary.occupiedRooms += 1;
            } else {
              occupancySummary.vacantRooms += 1;
            }

            if (!roomIsInactive) {
              occupancySummary.totalBeds += roomCapacity;
              occupancySummary.occupiedBeds += occupiedBedsInRoom;
            }

            const row = byHostel.get(room.hostel_id);
            if (!row) continue;

            row.totalRooms += 1;
            if (roomIsOccupied && !roomIsInactive && !roomIsMaintenance) {
              row.occupiedRooms += 1;
            }
            if (!roomIsInactive) {
              row.totalBeds += roomCapacity;
              row.occupiedBeds += occupiedBedsInRoom;
            }
          }

          occupancySummary.vacantBeds = Math.max(
            occupancySummary.totalBeds - occupancySummary.occupiedBeds,
            0,
          );

          hostelOccupancy = Array.from(byHostel.values())
            .filter((row) => row.totalRooms > 0)
            .sort((a, b) => {
              const aRate = a.totalBeds > 0 ? a.occupiedBeds / a.totalBeds : 0;
              const bRate = b.totalBeds > 0 ? b.occupiedBeds / b.totalBeds : 0;
              return bRate - aRate;
            });

          const [maintenanceResult, paymentsResult, expensesResult] =
            await Promise.all([
              admin
                .from("maintenance_requests")
                .select("id", { count: "exact", head: true })
                .in("hostel_id", hostelIds)
                .eq("status", "open")
                .is("deleted_at", null),
              admin
                .from("payments")
                .select(
                  "tenant_id, hostel_id, amount, billing_end, paid_on, status",
                )
                .in("hostel_id", hostelIds)
                .lte("paid_on", monthEnd),
              admin
                .from("expenses")
                .select("amount")
                .in("hostel_id", hostelIds)
                .is("deleted_at", null)
                .gte("expense_date", monthStart)
                .lt("expense_date", nextMonthStart),
            ]);

          openMaintenanceCount = maintenanceResult.count ?? 0;

          const paidPayments = (paymentsResult.data ?? []).filter(
            (payment) => payment.status === "paid",
          );
          thisMonthRentPaid = paidPayments
            .filter(
              (payment) =>
                payment.paid_on >= monthStart &&
                payment.paid_on < nextMonthStart,
            )
            .reduce(
            (acc, row) => acc + Number(row.amount),
              0,
            );

          thisMonthRevenueExpected = (tenants ?? []).reduce((sum, tenant) => {
            const agreed = Number(tenant.agreed_rent_amount) || 0;
            if (agreed <= 0) return sum;

            const tenantStart = tenant.rent_start_date ?? tenant.join_date;
            const tenantEnd = tenant.move_out_date;
            if (
              (tenantStart && tenantStart > monthEnd) ||
              (tenantEnd && tenantEnd < monthStart)
            ) {
              return sum;
            }

            const tenantPayments = paidPayments.filter(
              (payment) =>
                payment.tenant_id === tenant.id &&
                payment.hostel_id === tenant.hostel_id &&
                (!tenantStart || payment.paid_on >= tenantStart),
            );
            const hasPaidThisMonth = paidPayments.some(
              (payment) =>
                payment.tenant_id === tenant.id &&
                payment.hostel_id === tenant.hostel_id &&
                payment.paid_on >= monthStart &&
                payment.paid_on < nextMonthStart,
            );
            if (tenant.status !== "active" && !hasPaidThisMonth) return sum;

            const received = tenantPayments
              .filter(
                (payment) =>
                  payment.paid_on >= monthStart &&
                  payment.paid_on < nextMonthStart,
              )
              .reduce((total, payment) => total + Number(payment.amount), 0);
            const billingEnd = tenantPayments
              .filter((payment) => payment.billing_end)
              .sort((a, b) =>
                (b.billing_end ?? "").localeCompare(a.billing_end ?? ""),
              )[0]?.billing_end;
            const pending = billingEnd && billingEnd >= monthEnd ? 0 : agreed;

            return sum + received + pending;
          }, 0);

          thisMonthExpenseTotal = (expensesResult.data ?? []).reduce(
            (acc, row) => acc + Number(row.amount),
            0,
          );

        }
      } else {
        // No properties at all
        setupRequired = true;
      }
    }
  }

  const thisMonthNetCash = thisMonthRentPaid - thisMonthExpenseTotal;
  const bedOccupancyRate =
    occupancySummary.totalBeds > 0
      ? Math.round(
          (occupancySummary.occupiedBeds / occupancySummary.totalBeds) * 100,
        )
      : 0;
  const collectionRate =
    thisMonthRevenueExpected > 0
      ? Math.round((thisMonthRentPaid / thisMonthRevenueExpected) * 100)
      : 0;
  const outstandingAmount = Math.max(
    thisMonthRevenueExpected - thisMonthRentPaid,
    0,
  );
  const stats = [
    {
      label: "Occupancy",
      subtitle: `occupied / total beds`,
      value: `${occupancySummary.occupiedBeds} / ${occupancySummary.totalBeds} beds`,
      progress: bedOccupancyRate,
      progressLabel: "Occupied",
      description: `Total tenants: ${new Intl.NumberFormat("en-IN").format(activeTenantsCount)}`,
      icon: Building2,
      change: occupancySummary.totalBeds > 0 ? "" : "No beds configured yet",
      gradient: "from-sky-500 to-blue-600",
      iconColor: "text-white",
      iconBg: "bg-white/20",
    },
    {
      label: "Rent Collected",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRentPaid)}`,
      progress: collectionRate,
      progressLabel: "Collected",
      description: "Sum of paid payments in this month.",
      icon: CreditCard,
      change:
        thisMonthRevenueExpected > 0
          ? `${Math.min(collectionRate, 100)}% collected`
          : "No payment activity yet",
      gradient: "from-indigo-500 to-blue-700",
      iconColor: "text-white",
      iconBg: "bg-white/20",
    },
    {
      label: "Expected Rent Collection",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRevenueExpected)}`,
      description: "Sum of active tenant rent obligations for this month.",
      badge:
        outstandingAmount > 0
          ? `Rs. ${new Intl.NumberFormat("en-IN").format(outstandingAmount)} outstanding`
          : undefined,
      icon: TrendingUp,
      change:
        thisMonthRevenueExpected > 0
          ? "Outstanding rent for current month"
          : "Revenue will appear after setup",
      gradient: "from-violet-500 to-purple-600",
      iconColor: "text-white",
      iconBg: "bg-white/20",
    },
    {
      label: "Expenses",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthExpenseTotal)}`,
      description: "Property operating costs recorded this month.",
      icon: AlertCircle,
      change:
        thisMonthExpenseTotal > 0
          ? "Expenses this month"
          : "No expenses recorded yet",
      gradient: "from-teal-500 to-cyan-700",
      iconColor: "text-white",
      iconBg: "bg-white/20",
    },
    {
      label: "Net Cash Flow",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthNetCash)}`,
      description: "Paid rent collected minus recorded expenses.",
      icon: IndianRupee,
      change:
        thisMonthNetCash >= 0 ? "Net positive cash flow" : "Negative cash flow",
      gradient:
        thisMonthNetCash >= 0
          ? "from-emerald-500 to-green-600"
          : "from-rose-500 to-red-600",
      iconColor: "text-white",
      iconBg: "bg-white/20",
    },
  ];

  return (
    <div className="space-y-3">
      {/* ── Top dashboard prompts ─────────────────────────── */}
      <div className="space-y-2">
        {!hasProperties && (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-foreground">
                    Welcome to NestDesk — add your first property
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    Add your first property to start managing rooms, tenants,
                    and rent collection.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button asChild className="rounded-lg px-2 py-0.5 text-[10px]">
                  <Link href="/hostels/new">
                    Add Property
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card className="hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 p-2 sm:block">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  Subscription Overview
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Plan, status, and renewal details
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:ml-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1 dark:bg-slate-950/60">
                <span className="uppercase tracking-[0.08em] text-[10px]">
                  Current Plan
                </span>
                <span className="font-semibold text-foreground">
                  {formatPlanLabel(currentPlan)}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1 dark:bg-slate-950/60">
                <span className="uppercase tracking-[0.08em] text-[10px]">
                  Status
                </span>
                <span className="font-semibold uppercase text-foreground">
                  {subscriptionStatusLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1 dark:bg-slate-950/60">
                <span className="uppercase tracking-[0.08em] text-[10px]">
                  Valid Till
                </span>
                <span className="font-semibold text-foreground">
                  {currentPlan === "free"
                    ? "-"
                    : subscriptionEndsAt
                      ? formatDateInIndia(subscriptionEndsAt, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <Link
                href="/subscriptions"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Manage
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
          {previousPlanExpiredNote ? (
            <div className="mt-3 rounded-2xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/10 dark:text-amber-200">
              {previousPlanExpiredNote}
            </div>
          ) : null}
        </Card>
        {!isPhoneVerified && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-50 p-2 dark:bg-amber-950/10">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                  <Phone className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-foreground">
                    Verify your phone number
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    Verify your phone on profile to activate properties and
                    receive tenant updates.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button asChild className="rounded-lg px-2 py-0.5 text-[10px]">
                  <Link href="/profile">
                    Verify Phone
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasProperties && setupRequired && setupProperty && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Complete your property setup
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {setupProperty.name}
                  </span>{" "}
                  has no floors or rooms configured yet. Set up the floor plan
                  to start managing tenants.
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                  <MapPin className="h-3 w-3" />
                  Property created — floors &amp; rooms pending
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild className="rounded-xl gap-2">
                <Link href={`/hostels/${setupProperty.id}/setup`}>
                  Set Up Floor Plan
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasProperties &&
        !setupRequired &&
        inactiveCount > 0 &&
        activeCount === 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/8 to-amber-400/4 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {inactiveCount === 1
                      ? "Your property is inactive"
                      : `All ${inactiveCount} properties are inactive`}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {inactiveCount === 1
                      ? "Your property has been added and the floor plan is ready. Activate it to start accepting tenants and managing rooms."
                      : `You have ${inactiveCount} properties with floor plans ready. Activate them to start accepting tenants and managing rooms.`}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl gap-2 border-amber-400/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <Link href="/hostels">
                    Go to My Properties
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

      {openMaintenanceCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/8 to-amber-400/4 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                <Wrench className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {openMaintenanceCount} new maintenance request
                  {openMaintenanceCount === 1 ? "" : "s"}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tenants have raised new issues. Open maintenance to review,
                  comment, and update statuses.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild className="rounded-xl gap-2">
                <Link href="/maintenance">
                  Open Maintenance
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main split: tiles (left) · occupancy (right) ──── */}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        {/* Left half — Microsoft-style tiles */}
        <div className="grid grid-cols-2 content-start gap-2 sm:gap-3">
          {stats.map(
            (
              {
                label,
                subtitle,
                value,
                icon: Icon,
                change,
                description,
                badge,
                progress,
                progressLabel,
                gradient,
                iconColor,
                iconBg,
              },
              index,
            ) => (
              <Card
                key={label}
                className={`card-hover overflow-hidden rounded-xl border-transparent bg-gradient-to-br text-white shadow-sm ${gradient} ${
                  index === stats.length - 1 && stats.length % 2 === 1
                    ? "col-span-2"
                    : ""
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-xs font-semibold uppercase tracking-wide text-white/85">
                      {label}
                    </CardTitle>
                    {subtitle ? (
                      <p className="mt-0.5 text-[10px] uppercase text-white/60">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <div className="text-xl font-bold text-white sm:text-2xl">
                    {value}
                  </div>
                  {progress !== undefined ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-white/70">
                        <span>{progressLabel ?? "Collected"}</span>
                        <span className="font-semibold text-white">
                          {progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{
                            width: `${Math.min(Math.max(progress, 0), 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {description ? (
                    <p className="mt-2 hidden text-[11px] leading-snug text-white/70 sm:block">
                      {description}
                    </p>
                  ) : null}
                  {badge ? (
                    <div className="mt-3 inline-flex items-center rounded-full bg-rose-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-rose-100">
                      {badge}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-white/70">{change}</p>
                  )}
                  {badge && change ? (
                    <p className="mt-1.5 text-[11px] text-rose-200">{change}</p>
                  ) : null}
                </CardContent>
              </Card>
            ),
          )}
        </div>

        {/* Right half — Room occupancy */}
        <Card className="flex h-full flex-col rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Room Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {hasProperties ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-2xl font-bold text-foreground">
                      {occupancySummary.occupiedBeds} /{" "}
                      {occupancySummary.totalBeds}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {bedOccupancyRate}% bed occupancy
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(bedOccupancyRate, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {occupancySummary.vacantBeds} bed
                    {occupancySummary.vacantBeds === 1 ? "" : "s"} available
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1.5">
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">
                      Occupied
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.occupiedRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-1.5">
                    <p className="font-medium text-sky-700 dark:text-sky-300">
                      Vacant
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.vacantRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-1.5">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Maintenance
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.maintenanceRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-500/20 bg-zinc-500/5 p-1.5">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                      Inactive
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.inactiveRooms} rooms
                    </p>
                  </div>
                </div>

                {hostelOccupancy.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      By Property
                    </p>
                    <div className="space-y-2">
                      {hostelOccupancy.slice(0, 4).map((row) => {
                        const rowRate =
                          row.totalBeds > 0
                            ? Math.round(
                                (row.occupiedBeds / row.totalBeds) * 100,
                              )
                            : 0;

                        return (
                          <div key={row.id} className="rounded-lg border p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium text-foreground">
                                {row.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {row.occupiedBeds}/{row.totalBeds} beds
                              </p>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.min(rowRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button asChild variant="default" size="sm" className="w-full">
                  <Link href="/hostels">Open Room Setup</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No rooms available yet. Complete property setup to view
                occupancy.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
