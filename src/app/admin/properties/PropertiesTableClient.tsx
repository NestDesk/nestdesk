"use client";

import { useMemo, useState } from "react";
import { Input } from "../../../components/ui/input";
import { CheckCircle2, Search, Users, XCircle } from "lucide-react";
import { formatDateInIndia } from "../../../lib/date";

interface HostelRow {
  id: string;
  name: string;
  property_type: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  total_rooms: number;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  owners:
    | {
        full_name: string;
        email: string | null;
        phone: string | null;
        plan: string;
      }[]
    | null;
}

interface RoomsByHostel {
  [hostelId: string]: {
    total: number;
    vacant: number;
    occupied: number;
    maintenance: number;
  };
}

interface Props {
  hostels: HostelRow[];
  roomsByHostel: RoomsByHostel;
  tenantsByHostel: Record<string, number>;
}

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

export default function AdminPropertiesTable({
  hostels,
  roomsByHostel,
  tenantsByHostel,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHostels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return hostels;

    return hostels.filter((hostel) => {
      const owner = hostel.owners?.[0];
      const searchValues = [hostel.name, owner?.email ?? "", owner?.phone ?? ""];
      return searchValues.some((value) => value.toLowerCase().includes(query));
    });
  }, [hostels, searchQuery]);

  return (
    <div>
      <div className="border-b border-border/60 bg-muted/5 px-4 py-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by property, email, or mobile"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Property
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rooms
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tenants
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredHostels.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  {searchQuery
                    ? "No properties match your search."
                    : "No properties found."}
                </td>
              </tr>
            ) : (
              filteredHostels.map((hostel) => {
                const rooms = roomsByHostel[hostel.id];
                const activeTenants = tenantsByHostel[hostel.id] ?? 0;
                const owner = hostel.owners?.[0] ?? null;

                return (
                  <tr
                    key={hostel.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{hostel.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {hostel.address}, {hostel.city}, {hostel.state}{" "}
                        {hostel.pincode}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground">
                        {owner?.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {owner?.phone
                          ? `${owner.phone} · ${owner.email ?? "—"}`
                          : (owner?.email ?? "—")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[hostel.property_type] ?? "bg-muted"}`}
                      >
                        {TYPE_LABELS[hostel.property_type] ?? hostel.property_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rooms ? (
                        <div className="text-xs">
                          <p className="font-semibold text-foreground">
                            {rooms.total}
                          </p>
                          <p className="text-muted-foreground">
                            {rooms.occupied} occ · {rooms.vacant} vacant
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 font-medium text-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {activeTenants}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hostel.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatDateInIndia(hostel.created_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
