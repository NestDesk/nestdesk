"use client";

import { useEffect, useState } from "react";
import { BedDouble, Building2, ChevronDown, Wrench } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

type RoomStatus =
  | "vacant"
  | "occupied"
  | "occupied_partial"
  | "maintenance"
  | "inactive";
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
  rentAmount: number | null;
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

const STATE_STYLES = {
  occupied_full: {
    card: "border-emerald-500/50 dark:border-emerald-500/30",
    header: "bg-emerald-500/10",
    dot: "bg-emerald-500",
    bedFill: "bg-emerald-500/10 border border-emerald-500/30",
    bedIcon: "text-emerald-600 dark:text-emerald-400",
  },
  occupied_partial: {
    card: "border-blue-500/50 dark:border-blue-500/30",
    header: "bg-blue-500/10",
    dot: "bg-blue-500",
    bedFill: "bg-primary/10 border border-primary/25",
    bedIcon: "text-primary",
  },
  vacant: {
    card: "border-border/70",
    header: "bg-muted/40",
    dot: "bg-slate-400 dark:bg-slate-500",
    bedFill: "bg-primary/10 border border-primary/25",
    bedIcon: "text-primary",
  },
  maintenance: {
    card: "border-amber-500/50 dark:border-amber-500/30",
    header: "bg-amber-500/10",
    dot: "bg-amber-500",
    bedFill: "bg-amber-500/10 border border-amber-500/30",
    bedIcon: "text-amber-600 dark:text-amber-400",
  },
  inactive: {
    card: "border-border/40",
    header: "bg-muted/20",
    dot: "bg-zinc-400 dark:bg-zinc-600",
    bedFill: "bg-muted/30 border border-border/40",
    bedIcon: "text-muted-foreground/40",
  },
} as const;

function RoomCard({ room }: { room: OccupancyRoom }) {
  const state = getRoomOccupancyState(
    room.status,
    room.occupiedCount,
    room.capacity,
  );
  const styles = STATE_STYLES[state];
  const activeTenants = room.assignedTenants.filter((t) => t.status === "active");

  return (
    <div
      className={cn(
        "relative w-[180px] shrink-0 overflow-hidden rounded-xl border-2 bg-card shadow-sm",
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.35)]",
        styles.card,
        state === "inactive" && "opacity-55",
      )}
    >
      {/* Room header */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/40 px-2.5 py-2",
          styles.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)} />
          <span className="truncate text-[13px] font-bold leading-none text-foreground">
            {room.roomNumber}
          </span>
        </div>
        <span className="shrink-0 pl-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {room.occupiedCount}/{room.capacity}
        </span>
      </div>

      {/* Beds */}
      <div className="space-y-1 p-2">
        {Array.from({ length: room.capacity }).map((_, idx) => {
          const tenant = activeTenants[idx];
          const isOccupied = !!tenant;

          return (
            <div
              key={`${room.id}-bed-${idx}`}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-[5px]",
                isOccupied
                  ? styles.bedFill
                  : "border border-dashed border-border/40",
              )}
            >
              <BedDouble
                className={cn(
                  "h-3 w-3 shrink-0",
                  isOccupied ? styles.bedIcon : "text-muted-foreground/25",
                )}
              />
              {isOccupied ? (
                <span className="truncate text-[11px] font-medium leading-none text-foreground">
                  {tenant.full_name}
                </span>
              ) : (
                <span className="select-none text-[11px] leading-none text-muted-foreground/30">
                  ——
                </span>
              )}
            </div>
          );
        })}

        {state === "maintenance" && (
          <div className="mt-1 flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-1">
            <Wrench className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
              Maintenance
            </span>
          </div>
        )}
      </div>
    </div>
  );
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
    <div className="space-y-4">
      {properties.map((property) => {
        const isExpanded = expandedById[property.id] ?? false;
        const occupancyPct =
          property.totalBeds > 0
            ? Math.round((property.occupiedBeds / property.totalBeds) * 100)
            : 0;

        return (
          <Card
            key={property.id}
            className="relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-background via-background to-primary/[0.04] shadow-[0_12px_32px_-20px_rgba(15,23,42,0.4)]"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />

            {/* Property header — clickable */}
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedById((prev) => ({
                  ...prev,
                  [property.id]: !isExpanded,
                }))
              }
              className="relative w-full px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base font-bold">
                    {property.name}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[property.city, property.state].filter(Boolean).join(", ") ||
                      "Location not set"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <Badge
                      variant="outline"
                      className="gap-1 border-border/60 text-xs"
                    >
                      <Building2 className="h-3 w-3" />
                      {property.totalRooms}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="gap-1 border-primary/30 bg-primary/8 text-xs text-primary dark:text-blue-300"
                    >
                      <BedDouble className="h-3 w-3" />
                      {property.occupiedBeds}/{property.totalBeds}
                    </Badge>
                    <Badge
                      variant={property.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {property.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition hover:bg-muted/70">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Occupancy progress */}
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-indigo-500 shadow-[0_2px_6px_rgba(99,102,241,0.4)]"
                    style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {occupancyPct}%
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {property.vacantBeds} vacant
                </span>
              </div>
            </button>

            {/* Floor + room grid */}
            {isExpanded && (
              <div className="space-y-5 border-t border-border/50 px-5 pb-5 pt-4">
                {property.floors.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    No floors configured yet for this property.
                  </p>
                ) : (
                  property.floors.map((floor) => (
                    <section key={floor.id} className="space-y-2.5">
                      {/* Floor label */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {floor.name}
                        </span>
                        <div className="h-px flex-1 bg-border/50" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {floor.rooms.length} room
                          {floor.rooms.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {floor.rooms.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
                          No rooms on this floor yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2.5 pb-1.5 pt-1.5">
                          {floor.rooms.map((room) => (
                            <RoomCard key={room.id} room={room} />
                          ))}
                        </div>
                      )}
                    </section>
                  ))
                )}

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-3">
                  {[
                    { dot: "bg-emerald-500", label: "Full" },
                    { dot: "bg-blue-500", label: "Partial" },
                    { dot: "bg-slate-400 dark:bg-slate-500", label: "Vacant" },
                    { dot: "bg-amber-500", label: "Maintenance" },
                    { dot: "bg-zinc-400 dark:bg-zinc-600", label: "Inactive" },
                  ].map(({ dot, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", dot)} />
                      <span className="text-[11px] text-muted-foreground">
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
