"use client";

import { useEffect, useState } from "react";
import { BedDouble, Building2, ChevronDown, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

type RoomStatus = "vacant" | "occupied" | "maintenance" | "inactive";
type TenantStatus = "pending" | "active" | "moved_out" | "rejected";

type RoomOccupancyState =
  | "occupied_full"
  | "occupied_partial"
  | "vacant"
  | "inactive"
  | "maintenance";

export type OccupancyTenant = {
  id: string;
  full_name: string;
  phone: string | null;
  status: TenantStatus;
  join_date: string | null;
  agreed_rent_amount: number | null;
};

export type OccupancyRoom = {
  id: string;
  roomNumber: string;
  capacity: number;
  rentAmount: number;
  status: RoomStatus;
  occupiedCount: number;
  availableCount: number;
  assignedTenants: OccupancyTenant[];
};

export type OccupancyFloor = {
  id: string;
  name: string;
  rooms: OccupancyRoom[];
};

export type OccupancyProperty = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  floors: OccupancyFloor[];
};

function formatCurrency(value: number | null): string {
  if (!value || value <= 0) {
    return "-";
  }

  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roomTypeLabel(capacity: number): string {
  if (capacity === 1) return "Single";
  if (capacity === 2) return "Double";
  if (capacity === 3) return "Triple";
  if (capacity === 4) return "Quad";
  return `${capacity}-bed`;
}

function getRoomOccupancyState(
  status: RoomStatus,
  occupiedCount: number,
  capacity: number,
): RoomOccupancyState {
  if (status === "inactive") return "inactive";
  if (status === "maintenance") return "maintenance";
  if (occupiedCount <= 0) return "vacant";
  if (occupiedCount >= capacity) return "occupied_full";
  return "occupied_partial";
}

function occupancyStateLabel(state: RoomOccupancyState): string {
  if (state === "occupied_full") return "Occupied Full";
  if (state === "occupied_partial") return "Occupied Partial";
  if (state === "vacant") return "Vacant";
  if (state === "inactive") return "Inactive";
  return "Maintenance";
}

function occupancyStateBadgeClass(state: RoomOccupancyState): string {
  if (state === "occupied_full") {
    return "border-emerald-300/80 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (state === "occupied_partial") {
    return "border-blue-300/80 bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }
  if (state === "vacant") {
    return "border-cyan-300/80 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
  }
  if (state === "inactive") {
    return "border-zinc-300/80 bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
  return "border-amber-300/80 bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

function tenantStatusBadgeClass(status: TenantStatus): string {
  if (status === "active") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (status === "pending") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  if (status === "moved_out") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }
  return "border-rose-300 bg-rose-50 text-rose-700";
}

export function PropertyOccupancyAccordion({
  properties,
}: {
  properties: OccupancyProperty[];
}) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialState: Record<string, boolean> = {};
    properties.forEach((property, index) => {
      initialState[property.id] = index === 0;
    });
    setExpandedById(initialState);
  }, [properties]);

  return (
    <div className="space-y-5">
      {properties.map((property) => {
        const isExpanded = expandedById[property.id] ?? false;

        return (
          <Card
            key={property.id}
            className="relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-background via-background to-blue-500/5 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.55)]"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">{property.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {[property.city, property.state].filter(Boolean).join(", ") ||
                      "Location not set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-slate-300/70 bg-white/70 dark:bg-background/50"
                  >
                    <Building2 className="h-3 w-3" />
                    {property.totalRooms} rooms
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-blue-300/70 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  >
                    <BedDouble className="h-3 w-3" />
                    {property.occupiedBeds}/{property.totalBeds} beds occupied
                  </Badge>
                  <Badge variant={property.isActive ? "default" : "secondary"}>
                    {property.isActive ? "Active property" : "Inactive property"}
                  </Badge>
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse property" : "Expand property"}
                    onClick={() =>
                      setExpandedById((prev) => ({
                        ...prev,
                        [property.id]: !isExpanded,
                      }))
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-transform hover:bg-muted/70"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 shadow-[0_4px_16px_rgba(59,130,246,0.5)]"
                  style={{
                    width: `${Math.min(
                      property.totalBeds > 0
                        ? Math.round(
                            (property.occupiedBeds / property.totalBeds) * 100,
                          )
                        : 0,
                      100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {property.vacantBeds} vacant bed
                {property.vacantBeds === 1 ? "" : "s"} available
              </p>
            </div>

            {isExpanded && (
              <CardContent className="space-y-4 border-t border-border/60 pb-5 pt-4">
                {property.floors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                    No floors configured yet for this property.
                  </div>
                ) : (
                  property.floors.map((floor) => {
                    return (
                      <section key={floor.id} className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {floor.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {floor.rooms.length} room
                            {floor.rooms.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        {floor.rooms.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                            No rooms on this floor yet.
                          </div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {floor.rooms.map((room) => {
                              const occupancyState = getRoomOccupancyState(
                                room.status,
                                room.occupiedCount,
                                room.capacity,
                              );

                              return (
                                <div
                                  key={room.id}
                                  className="group/room relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.95)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_34px_-20px_rgba(15,23,42,0.9)] dark:from-background dark:via-slate-900/60 dark:to-slate-950"
                                >
                                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
                                  <div className="relative flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">
                                        Room {room.roomNumber}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {roomTypeLabel(room.capacity)} | Capacity{" "}
                                        {room.capacity}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={occupancyStateBadgeClass(
                                        occupancyState,
                                      )}
                                    >
                                      {occupancyStateLabel(occupancyState)}
                                    </Badge>
                                  </div>

                                  <div className="relative mt-2 rounded-xl border border-slate-300/40 bg-white/70 p-2 dark:border-slate-700/50 dark:bg-slate-900/40">
                                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span>Bed Occupancy</span>
                                      <span>
                                        {room.occupiedCount}/{room.capacity}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Array.from({ length: room.capacity }).map(
                                        (_, bedIdx) => {
                                          const occupied =
                                            bedIdx < room.occupiedCount;
                                          return (
                                            <span
                                              key={`${room.id}-bed-${bedIdx}`}
                                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-semibold ${
                                                occupied
                                                  ? "border-blue-400/60 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                                  : "border-slate-300/70 bg-slate-200/60 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400"
                                              }`}
                                            >
                                              <BedDouble className="h-3.5 w-3.5" />
                                            </span>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <Badge variant="outline">
                                      {room.occupiedCount}/{room.capacity} occupied
                                    </Badge>
                                    <Badge variant="outline">
                                      {room.availableCount} available
                                    </Badge>
                                    <Badge variant="outline">
                                      Rent {formatCurrency(room.rentAmount)}
                                    </Badge>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Allocated Tenants
                                    </p>

                                    {room.assignedTenants.length === 0 ? (
                                      <div className="rounded-lg border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
                                        No tenant allocated
                                      </div>
                                    ) : (
                                      room.assignedTenants.map((tenant) => (
                                        <div
                                          key={tenant.id}
                                          className="rounded-lg border border-border/70 bg-background p-2"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium text-foreground">
                                                {tenant.full_name}
                                              </p>
                                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                <span className="inline-flex items-center gap-1">
                                                  <User className="h-3 w-3" />
                                                  Joined{" "}
                                                  {formatDate(tenant.join_date)}
                                                </span>
                                                {tenant.phone && (
                                                  <span className="inline-flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {tenant.phone}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="mt-1 text-[11px] text-muted-foreground">
                                                Agreed Rent:{" "}
                                                {formatCurrency(
                                                  tenant.agreed_rent_amount,
                                                )}
                                              </p>
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className={tenantStatusBadgeClass(
                                                tenant.status,
                                              )}
                                            >
                                              {tenant.status.replace("_", " ")}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
