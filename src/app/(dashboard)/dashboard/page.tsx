import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
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
import { calculateRent } from "../../../lib/billing";
import { formatPlanLabel, normalizeOwnerPlan } from "../../../lib/subscriptions";

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

type RecentPaymentRow = {
  id: string;
  amount: number;
  tenant_name: string;
  room_number: string | null;
  hostel_name: string;
  status: string;
  method: string | null;
  paid_on: string | null;
  created_at: string;
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
  let recentPayments: RecentPaymentRow[] = [];
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
      currentPlan = normalizeOwnerPlan(owner.plan);
      isPhoneVerified = owner.phone_verified;

      const { data: currentSubscription } = await admin
        .from("subscriptions")
        .select("status, ends_at")
        .eq("owner_id", owner.id)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentSubscription) {
        subscriptionStatus = currentSubscription.status;
        subscriptionEndsAt = currentSubscription.ends_at;
      }

      const { data: hostels, error: hostelsError } = await admin
        .from("hostels")
        .select("id, name, is_active")
        .eq("owner_id", owner.id)
        .order("created_at", { ascending: true });

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
          const { data: rooms, error: roomsError } = await admin
            .from("rooms")
            .select("id, hostel_id, capacity, rent_amount, status")
            .in("hostel_id", hostelIds)
            .is("deleted_at", null);

          if (roomsError) {
            console.error(
              "[dashboard] failed to load rooms for occupancy",
              roomsError,
            );
          }

          const { data: tenants, error: tenantsError } = await admin
            .from("tenants")
            .select(
              "id, hostel_id, room_id, status, created_at, agreed_rent_amount, join_date, rent_start_date, move_out_date",
            )
            .in("hostel_id", hostelIds)
            .is("deleted_at", null);

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

          const roomRentById = new Map<string, number>();
          for (const room of rooms ?? []) {
            roomRentById.set(room.id, Number(room.rent_amount) || 0);
          }

          thisMonthRevenueExpected = activeTenants.reduce((sum, tenant) => {
            const agreed = Number(tenant.agreed_rent_amount) || 0;
            if (agreed <= 0) return sum;

            const tenantStart =
              tenant.rent_start_date ?? tenant.join_date ?? monthStart;
            const startDate = tenantStart < monthStart ? monthStart : tenantStart;
            const tenantEnd = tenant.move_out_date ?? monthEnd;
            const endDate = tenantEnd > monthEnd ? monthEnd : tenantEnd;

            if (startDate > endDate) return sum;

            return sum + calculateRent(agreed, startDate, endDate).payableAmount;
          }, 0);

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

          const { count } = await admin
            .from("maintenance_requests")
            .select("id", { count: "exact", head: true })
            .in("hostel_id", hostelIds)
            .eq("status", "open")
            .is("deleted_at", null);

          openMaintenanceCount = count ?? 0;

          const { data: paidPayments } = await admin
            .from("payments")
            .select("amount")
            .in("hostel_id", hostelIds)
            .eq("status", "paid")
            .gte("month", monthStart)
            .lt("month", nextMonthStart);

          thisMonthRentPaid = (paidPayments ?? []).reduce(
            (acc, row) => acc + Number(row.amount),
            0,
          );

          const { data: expenses } = await admin
            .from("expenses")
            .select("amount")
            .in("hostel_id", hostelIds)
            .is("deleted_at", null)
            .gte("expense_date", monthStart)
            .lt("expense_date", nextMonthStart);

          thisMonthExpenseTotal = (expenses ?? []).reduce(
            (acc, row) => acc + Number(row.amount),
            0,
          );

          const { data: recentPaymentRows, error: recentPaymentsError } = await admin
            .from("payments")
            .select(
              "id, tenant_id, hostel_id, amount, status, method, paid_on, created_at",
            )
            .in("hostel_id", hostelIds)
            .order("paid_on", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10);

          if (recentPaymentsError) {
            console.error(
              "[dashboard] failed to load recent payments",
              recentPaymentsError,
            );
          } else {
            const tenantIds = Array.from(
              new Set(
                (recentPaymentRows ?? [])
                  .map((payment) => payment.tenant_id)
                  .filter((id): id is string => Boolean(id)),
              ),
            );

            const { data: recentTenants } = tenantIds.length
              ? await admin
                  .from("tenants")
                  .select("id, full_name, rooms(room_number)")
                  .in("id", tenantIds)
              : { data: [] };

            const tenantMap = new Map<
              string,
              { fullName: string; roomNumber: string | null }
            >();
            for (const tenant of (recentTenants ?? []) as Array<{
              id: string;
              full_name: string;
              rooms?:
                | { room_number: string }
                | Array<{ room_number: string }>
                | null;
            }>) {
              const room = Array.isArray(tenant.rooms)
                ? tenant.rooms[0]
                : tenant.rooms;
              tenantMap.set(tenant.id, {
                fullName: tenant.full_name,
                roomNumber: room?.room_number ?? null,
              });
            }

            const hostelNameMap = new Map(hostels.map((h) => [h.id, h.name]));
            recentPayments = (recentPaymentRows ?? []).map((payment) => {
              const tenant = tenantMap.get(payment.tenant_id ?? "");
              return {
                id: payment.id,
                amount: Number(payment.amount) || 0,
                tenant_name: tenant?.fullName ?? "Tenant",
                room_number: tenant?.roomNumber ?? null,
                hostel_name: hostelNameMap.get(payment.hostel_id) ?? "Property",
                status: payment.status,
                method: payment.method ?? null,
                paid_on: payment.paid_on,
                created_at: payment.created_at,
              };
            });
          }
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
      gradient: "from-sky-500/20 via-cyan-500/15 to-indigo-500/20",
      iconColor: "text-sky-500",
      iconBg: "bg-sky-500/10",
    },
    {
      label: "Rent Collected",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRentPaid)}`,
      progress: collectionRate,
      progressLabel: "Collected",
      description: undefined,
      icon: CreditCard,
      change:
        thisMonthRevenueExpected > 0
          ? `${Math.min(collectionRate, 100)}% collected`
          : "No payment activity yet",
      gradient: "from-emerald-500/20 via-lime-500/15 to-teal-500/20",
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "Expected Rent",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRevenueExpected)}`,
      description: undefined,
      badge:
        outstandingAmount > 0
          ? `Rs. ${new Intl.NumberFormat("en-IN").format(outstandingAmount)} outstanding`
          : undefined,
      icon: TrendingUp,
      change:
        thisMonthRevenueExpected > 0
          ? "Outstanding rent for current month"
          : "Revenue will appear after setup",
      gradient: "from-violet-500/20 via-fuchsia-500/15 to-pink-500/20",
      iconColor: "text-violet-500",
      iconBg: "bg-violet-500/10",
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
      gradient: "from-orange-400/20 via-amber-400/15 to-red-400/20",
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
    {
      label: "Net Cash Flow",
      subtitle: `${currentMonthRangeLabel}`,
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthNetCash)}`,
      description: "Paid rent collected minus recorded expenses.",
      icon: IndianRupee,
      change:
        thisMonthNetCash >= 0 ? "Net positive cash flow" : "Negative cash flow",
      gradient: "from-cyan-400/30 via-sky-400/20 to-indigo-500/30",
      iconColor: "text-cyan-500",
      iconBg: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-muted-foreground">
          Overview of your PG, colive, hostel, and rental business
        </p>
      </div>

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
                    Add your first property to start managing rooms, tenants, and
                    rent collection.
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

        <Card className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 p-2">
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
                <span className="uppercase tracking-[0.08em] text-[10px]">Plan</span>
                <span className="font-semibold text-foreground">
                  {formatPlanLabel(currentPlan)}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1 dark:bg-slate-950/60">
                <span className="uppercase tracking-[0.08em] text-[10px]">
                  Status
                </span>
                <span className="font-semibold uppercase text-foreground">
                  {subscriptionStatus}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1 dark:bg-slate-950/60">
                <span className="uppercase tracking-[0.08em] text-[10px]">
                  Valid Till
                </span>
                <span className="font-semibold text-foreground">
                  {subscriptionEndsAt
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
              <Button asChild className="rounded-lg pl-4 pr-4 py-0.5 text-[10px]">
                <Link href="/subscriptions">
                  Manage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
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
                    Verify your phone on profile to activate properties and receive
                    tenant updates.
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
                  has no floors or rooms configured yet. Set up the floor plan to
                  start managing tenants.
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

      {hasProperties && !setupRequired && inactiveCount > 0 && activeCount === 0 && (
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(
          ({
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
          }) => (
            <Card
              key={label}
              className={`card-hover rounded-2xl bg-gradient-to-br ${gradient} border-border/60`}
            >
              <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  {subtitle ? (
                    <p className="mt-1 text-[11px] uppercase text-muted-foreground">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <div className="text-2xl font-bold text-foreground">{value}</div>
                {progress !== undefined ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      <span>{progressLabel ?? "Collected"}</span>
                      <span className="font-semibold text-foreground">
                        {progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {description ? (
                  <p className="mt-3 text-xs text-muted-foreground">{description}</p>
                ) : null}
                {badge ? (
                  <div className="mt-4 inline-flex items-center rounded-full bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                    {badge}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">{change}</p>
                )}
                {badge && change ? (
                  <p className="mt-2 text-xs text-muted-foreground">{change}</p>
                ) : null}
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {hasProperties ? (
              recentPayments.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <div className="col-span-4">Tenant</div>
                    <div className="col-span-3">Property</div>
                    <div className="col-span-2">Amount</div>
                    <div className="col-span-3 text-right">Date</div>
                  </div>
                  <div className="space-y-3">
                    {recentPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid grid-cols-12 gap-3 rounded-2xl border border-border/70 bg-slate-50 p-3 dark:bg-slate-950"
                      >
                        <div className="col-span-4 min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {payment.tenant_name}
                          </p>
                          {payment.room_number ? (
                            <p className="truncate text-xs text-muted-foreground">
                              Room {payment.room_number}
                            </p>
                          ) : null}
                        </div>
                        <div className="col-span-3 truncate text-sm text-foreground">
                          {payment.hostel_name}
                        </div>
                        <div className="col-span-2 text-sm font-semibold text-foreground">
                          Rs. {new Intl.NumberFormat("en-IN").format(payment.amount)}
                        </div>
                        <div className="col-span-3 text-right">
                          <p className="text-sm text-foreground">
                            {formatDateInIndia(
                              payment.paid_on ?? payment.created_at,
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {payment.status === "paid" ? "Paid" : "Disputed"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/payments">View All Payments</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payments recorded yet. Add a property and tenants to start
                  tracking collections.
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                No payments yet. Add a property and tenants to start tracking
                collections.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Room Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {hasProperties ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-2xl font-bold text-foreground">
                      {occupancySummary.occupiedBeds} / {occupancySummary.totalBeds}
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
                            ? Math.round((row.occupiedBeds / row.totalBeds) * 100)
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

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/hostels">Open Room Setup</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No rooms available yet. Complete property setup to view occupancy.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
