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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const defaultStats = [
  {
    label: "Total Tenants",
    value: "24",
    icon: Users,
    change: "+2 this month",
    gradient: "from-blue-500/10 to-indigo-500/10",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    label: "Occupied Rooms",
    value: "18 / 24",
    icon: Building2,
    change: "75% occupancy",
    gradient: "from-blue-600/10 to-indigo-500/10",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-600/10",
  },
  {
    label: "Rent Collected",
    value: "Rs. 54,000",
    icon: CreditCard,
    change: "90% collected",
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Monthly Revenue",
    value: "Rs. 60,000",
    icon: TrendingUp,
    change: "+12% vs last",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
];

const emptyStats = [
  {
    label: "Total Tenants",
    value: "0",
    icon: Users,
    change: "Add a property to view tenant data",
    gradient: "from-blue-500/10 to-indigo-500/10",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    label: "Occupied Rooms",
    value: "0 / 0",
    icon: Building2,
    change: "No rooms configured yet",
    gradient: "from-blue-600/10 to-indigo-500/10",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-600/10",
  },
  {
    label: "Rent Collected",
    value: "Rs. 0",
    icon: CreditCard,
    change: "No payment activity yet",
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Monthly Revenue",
    value: "Rs. 0",
    icon: TrendingUp,
    change: "Revenue will appear after setup",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
];

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

  if (user) {
    const { data: owner } = await admin
      .from("owners")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (owner) {
      const { data: hostels } = await admin
        .from("hostels")
        .select("id, name, is_active")
        .eq("owner_id", owner.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

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
      } else {
        // No properties at all
        setupRequired = true;
      }
    }
  }

  const stats = hasProperties ? defaultStats : emptyStats;

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
            <p className="text-sm text-muted-foreground">
              {hasProperties
                ? "Room grid -- Week 2"
                : "No rooms available yet. Complete property setup to view occupancy."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
