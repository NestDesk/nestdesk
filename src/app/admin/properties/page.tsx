import { createAdminClient } from "../../../lib/supabase/admin";
import { Card, CardContent } from "../../../components/ui/card";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import AdminPropertiesTable from "./PropertiesTableClient";

const TYPE_LABELS: Record<string, string> = {
  pg: "PG",
  hostel: "Hostel",
  coliving: "Co-living",
  rental: "Rental",
};

const TYPE_COLORS: Record<string, string> = {
  pg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  hostel: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  coliving: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rental: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const admin = createAdminClient();

  const [
    { data: hostels, count: total },
    { count: activeCount },
    { count: inactiveCount },
    { data: roomStats },
    { data: tenantStats },
  ] = await Promise.all([
    admin
      .from("hostels")
      .select(
        "id, name, property_type, address, city, state, pincode, total_rooms, is_active, created_at, owner_id, owners!inner(full_name, email, phone, plan)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("hostels")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    admin
      .from("hostels")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false),
    admin.from("rooms").select("hostel_id, status").is("deleted_at", null),
    admin
      .from("tenants")
      .select("hostel_id")
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  const roomsByHostel = new Map<
    string,
    { total: number; vacant: number; occupied: number; maintenance: number }
  >();
  for (const r of roomStats ?? []) {
    const prev = roomsByHostel.get(r.hostel_id) ?? {
      total: 0,
      vacant: 0,
      occupied: 0,
      maintenance: 0,
    };
    prev.total += 1;
    if (r.status === "vacant") prev.vacant += 1;
    else if (r.status === "occupied" || r.status === "occupied_partial")
      prev.occupied += 1;
    else if (r.status === "maintenance") prev.maintenance += 1;
    roomsByHostel.set(r.hostel_id, prev);
  }

  const tenantsByHostel = new Map<string, number>();
  for (const t of tenantStats ?? []) {
    tenantsByHostel.set(t.hostel_id, (tenantsByHostel.get(t.hostel_id) ?? 0) + 1);
  }

  const typeCount: Record<string, number> = {};
  for (const h of hostels ?? []) {
    typeCount[h.property_type] = (typeCount[h.property_type] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
          <Building2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Platform Inventory
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Properties
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total ?? 0} properties across all owner accounts
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {activeCount ?? 0} Active
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-zinc-500/10 px-4 py-2">
          <XCircle className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {inactiveCount ?? 0} Inactive
          </span>
        </div>
        {Object.entries(typeCount).map(([type, count]) => (
          <div
            key={type}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${TYPE_COLORS[type] ?? "bg-muted"}`}
          >
            {TYPE_LABELS[type] ?? type}: {count}
          </div>
        ))}
      </div>

      {/* Properties table */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardContent className="p-0">
          <AdminPropertiesTable
            hostels={hostels ?? []}
            roomsByHostel={Object.fromEntries(
              Array.from(roomsByHostel.entries()).map(([id, stats]) => [id, stats]),
            )}
            tenantsByHostel={Object.fromEntries(tenantsByHostel.entries())}
          />
        </CardContent>
      </Card>
    </div>
  );
}
