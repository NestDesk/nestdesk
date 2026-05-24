import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  ArrowRight,
  MapPin,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  let activeCount = 0;
  let inactiveCount = 0;
  let openMaintenanceCount = 0;
  let thisMonthExpenseTotal = 0;
  let thisMonthRentPaid = 0;
  let totalTenantsCount = 0;
  let newTenantsThisMonth = 0;
  let thisMonthRevenueExpected = 0;
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .slice(0, 10);

  if (user) {
    const { data: owner } = await admin
      .from("owners")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (owner) {
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
            .select("id, hostel_id, room_id, status, created_at, agreed_rent_amount")
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
          totalTenantsCount = (tenants ?? []).length;
          newTenantsThisMonth = (tenants ?? []).filter((tenant) => {
            return (
              tenant.created_at >= monthStart && tenant.created_at < nextMonthStart
            );
          }).length;

          const roomRentById = new Map<string, number>();
          for (const room of rooms ?? []) {
            roomRentById.set(room.id, Number(room.rent_amount) || 0);
          }

          thisMonthRevenueExpected = activeTenants.reduce((sum, tenant) => {
            const agreed = Number(tenant.agreed_rent_amount) || 0;
            if (agreed > 0) {
              return sum + agreed;
            }
            if (tenant.room_id) {
              return sum + (roomRentById.get(tenant.room_id) ?? 0);
            }
            return sum;
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
            const roomIsOccupied = activeInRoom > 0 || room.status === "occupied";
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
        }
      } else {
        // No properties at all
        setupRequired = true;
      }
    }
  }

  const thisMonthNetCash = thisMonthRentPaid - thisMonthExpenseTotal;
  const occupiableRooms =
    occupancySummary.occupiedRooms + occupancySummary.vacantRooms;
  const roomOccupancyRate =
    occupiableRooms > 0
      ? Math.round((occupancySummary.occupiedRooms / occupiableRooms) * 100)
      : 0;
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
  const stats = [
    {
      label: "Total Tenants",
      value: new Intl.NumberFormat("en-IN").format(totalTenantsCount),
      icon: Users,
      change:
        newTenantsThisMonth > 0
          ? `+${newTenantsThisMonth} this month`
          : "No new tenants this month",
      gradient: "from-blue-500/10 to-indigo-500/10",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      label: "Occupied Rooms",
      value: `${occupancySummary.occupiedRooms} / ${occupiableRooms}`,
      icon: Building2,
      change:
        occupiableRooms > 0
          ? `${roomOccupancyRate}% occupancy`
          : "No rooms configured yet",
      gradient: "from-blue-600/10 to-indigo-500/10",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-600/10",
    },
    {
      label: "Rent Collected",
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRentPaid)}`,
      icon: CreditCard,
      change:
        thisMonthRevenueExpected > 0
          ? `${Math.min(collectionRate, 100)}% collected`
          : "No payment activity yet",
      gradient: "from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "Monthly Revenue",
      value: `Rs. ${new Intl.NumberFormat("en-IN").format(thisMonthRevenueExpected)}`,
      icon: TrendingUp,
      change:
        thisMonthRevenueExpected > 0
          ? `Rs. ${new Intl.NumberFormat("en-IN").format(
              Math.max(thisMonthRevenueExpected - thisMonthRentPaid, 0),
            )} outstanding`
          : "Revenue will appear after setup",
      gradient: "from-orange-500/10 to-amber-500/10",
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-muted-foreground">
          Overview of your PG, colive, hostel, and rental business
        </p>
      </div>

      {/* ── Setup required / inactive banner ─────────────────────────── */}
      {!hasProperties && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Welcome to NestDesk — add your first property
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Your owner profile is ready. Add your first property to start
                  managing rooms, tenants, and rent collection.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild className="rounded-xl gap-2">
                <Link href="/hostels/new">
                  Add Property
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(
          ({ label, value, icon: Icon, change, gradient, iconColor, iconBg }) => (
            <Card
              key={label}
              className={`card-hover rounded-2xl bg-gradient-to-br ${gradient} border-border/60`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{change}</p>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {hasProperties && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base">This Month Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                Rs. {new Intl.NumberFormat("en-IN").format(thisMonthExpenseTotal)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Property operating costs recorded this month.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/expenses">Open Expenses</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base">This Month Net Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                Rs. {new Intl.NumberFormat("en-IN").format(thisMonthNetCash)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid rent collected minus recorded expenses.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Rent: Rs. {new Intl.NumberFormat("en-IN").format(thisMonthRentPaid)}{" "}
                | Expenses: Rs.{" "}
                {new Intl.NumberFormat("en-IN").format(thisMonthExpenseTotal)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {hasProperties
                ? "Payment list -- Week 4"
                : "No payments yet. Add a property and tenants to start tracking collections."}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Room Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {hasProperties ? (
              <div className="space-y-4">
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
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">
                      Occupied
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.occupiedRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
                    <p className="font-medium text-sky-700 dark:text-sky-300">
                      Vacant
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.vacantRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Maintenance
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.maintenanceRooms} rooms
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-500/20 bg-zinc-500/5 p-2">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                      Inactive
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {occupancySummary.inactiveRooms} rooms
                    </p>
                  </div>
                </div>

                {hostelOccupancy.length > 0 && (
                  <div className="space-y-2">
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
