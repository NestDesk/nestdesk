"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Search,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TenantStatus = "pending" | "active" | "moved_out" | "rejected";

type TenantRow = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  room_id: string | null;
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  agreed_rent_amount: number | null;
  join_date: string | null;
  move_out_date: string | null;
  created_at: string;
  updated_at: string;
};

type HostelSummary = {
  id: string;
  name: string;
  location: string;
};

type RoomSummary = {
  id: string;
  room_number: string;
  status: string;
};

type TenantsResponse = {
  tenants: TenantRow[];
  summary: {
    total: number;
    pending: number;
    active: number;
    moved_out: number;
    rejected: number;
  };
  hostels: HostelSummary[];
  roomsByHostel: Record<string, RoomSummary[]>;
};

type TenantDraft = {
  fullName: string;
  phone: string;
  status: TenantStatus;
  roomId: string | null;
  agreedRentAmount: string;
  joinDate: string;
  moveOutDate: string;
};

const STATUS_CHIP_CLASS: Record<TenantStatus, string> = {
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  active:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  moved_out:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
  rejected:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
};

const AVATAR_BG: Record<TenantStatus, string> = {
  pending: "from-amber-400 to-orange-500",
  active: "from-emerald-400 to-teal-500",
  moved_out: "from-slate-400 to-slate-500",
  rejected: "from-rose-400 to-rose-600",
};

const STATUS_OPTIONS: Array<{ value: TenantStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "moved_out", label: "Moved Out" },
  { value: "rejected", label: "Rejected" },
];

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function normalizeRentInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("").slice(0, 2);

  if (!whole && !fraction) {
    return "";
  }

  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole || "0"}.${fraction}`;
}

function formatDate(date: string | null) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: TenantStatus) {
  return status.replace("_", " ");
}

function formatCurrency(amount: number | null) {
  if (!amount || amount <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OwnerTenantsPage() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [summary, setSummary] = useState<TenantsResponse["summary"]>({
    total: 0,
    pending: 0,
    active: 0,
    moved_out: 0,
    rejected: 0,
  });
  const [hostels, setHostels] = useState<HostelSummary[]>([]);
  const [roomsByHostel, setRoomsByHostel] = useState<Record<string, RoomSummary[]>>(
    {},
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hostelFilter, setHostelFilter] = useState<string>("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TenantDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadTenants() {
    setLoading(true);
    try {
      const response = await fetch("/api/tenants", { cache: "no-store" });
      const json = (await response.json()) as TenantsResponse | { error?: string };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not load tenants.");
        return;
      }

      const payload = json as TenantsResponse;
      setTenants(payload.tenants ?? []);
      setSummary(payload.summary);
      setHostels(payload.hostels ?? []);
      setRoomsByHostel(payload.roomsByHostel ?? {});
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants().catch(() => {
      // handled in loadTenants
    });
  }, []);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        tenant.full_name.toLowerCase().includes(query) ||
        (tenant.email ?? "").toLowerCase().includes(query) ||
        (tenant.phone ?? "").includes(query) ||
        (tenant.room_number ?? "").toLowerCase().includes(query) ||
        tenant.hostel_name.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
      const matchesHostel =
        hostelFilter === "all" || tenant.hostel_id === hostelFilter;

      return matchesQuery && matchesStatus && matchesHostel;
    });
  }, [hostelFilter, searchQuery, statusFilter, tenants]);

  function startEdit(tenant: TenantRow) {
    setEditingId(tenant.id);
    setDrafts((prev) => ({
      ...prev,
      [tenant.id]: {
        fullName: tenant.full_name,
        phone: tenant.phone ?? "",
        status: tenant.status,
        roomId: tenant.room_id,
        agreedRentAmount:
          tenant.agreed_rent_amount !== null
            ? String(tenant.agreed_rent_amount)
            : "",
        joinDate: tenant.join_date ?? "",
        moveOutDate: tenant.move_out_date ?? "",
      },
    }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function updateDraft(
    tenantId: string,
    field: keyof TenantDraft,
    value: string | TenantStatus | null,
  ) {
    setDrafts((prev) => {
      const current = prev[tenantId];
      if (!current) return prev;
      return {
        ...prev,
        [tenantId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  function availableRooms(tenant: TenantRow) {
    const allRooms = roomsByHostel[tenant.hostel_id] ?? [];
    return allRooms.filter((room) => {
      if (room.id === tenant.room_id) return true;
      return room.status === "vacant";
    });
  }

  async function saveTenant(tenant: TenantRow) {
    const draft = drafts[tenant.id];
    if (!draft) {
      toast.error("Edit form not ready. Please try again.");
      return;
    }

    if (draft.status === "active" && !draft.roomId) {
      toast.error("Assign a room before marking tenant as active.");
      return;
    }

    if (draft.status === "active" && !draft.agreedRentAmount) {
      toast.error("Add agreed rent before marking tenant as active.");
      return;
    }

    setSavingId(tenant.id);

    try {
      const payload = {
        fullName: draft.fullName.trim(),
        phone: draft.phone.trim(),
        status: draft.status,
        roomId: draft.status === "active" ? draft.roomId : null,
        agreedRentAmount: draft.agreedRentAmount
          ? Number(draft.agreedRentAmount)
          : null,
        joinDate: draft.joinDate || null,
        moveOutDate: draft.status === "moved_out" ? draft.moveOutDate || null : null,
      };

      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as
        | { error?: string }
        | {
            success: boolean;
            tenant?: {
              id: string;
              hostel_id: string;
              room_id: string | null;
              full_name: string;
              email: string | null;
              phone: string | null;
              status: TenantStatus;
              agreed_rent_amount: number | null;
              join_date: string | null;
              move_out_date: string | null;
              created_at: string;
              updated_at: string;
            };
          };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not update tenant.");
        return;
      }

      const updatedTenant = "tenant" in json ? json.tenant : undefined;
      setTenants((prev) =>
        prev.map((row) => {
          if (row.id !== tenant.id) return row;

          if (!updatedTenant) {
            return {
              ...row,
              full_name: payload.fullName,
              phone: payload.phone || null,
              status: payload.status,
              room_id: payload.roomId,
              agreed_rent_amount: payload.agreedRentAmount,
              room_number:
                (roomsByHostel[row.hostel_id] ?? []).find(
                  (room) => room.id === payload.roomId,
                )?.room_number ?? null,
              join_date: payload.joinDate,
              move_out_date: payload.moveOutDate,
              updated_at: new Date().toISOString(),
            };
          }

          return {
            ...row,
            full_name: updatedTenant.full_name,
            email: updatedTenant.email,
            phone: updatedTenant.phone,
            status: updatedTenant.status,
            room_id: updatedTenant.room_id,
            agreed_rent_amount: updatedTenant.agreed_rent_amount,
            room_number:
              (roomsByHostel[row.hostel_id] ?? []).find(
                (room) => room.id === updatedTenant.room_id,
              )?.room_number ?? null,
            join_date: updatedTenant.join_date,
            move_out_date: updatedTenant.move_out_date,
            updated_at: updatedTenant.updated_at,
          };
        }),
      );

      setSummary((prev) => {
        const next = {
          total: tenants.length,
          pending: 0,
          active: 0,
          moved_out: 0,
          rejected: 0,
        };

        tenants.forEach((row) => {
          const candidate =
            row.id === tenant.id ? { ...row, status: draft.status } : row;
          if (candidate.status === "pending") next.pending += 1;
          if (candidate.status === "active") next.active += 1;
          if (candidate.status === "moved_out") next.moved_out += 1;
          if (candidate.status === "rejected") next.rejected += 1;
        });

        return { ...prev, ...next };
      });

      setEditingId(null);
      loadTenants().catch(() => {
        // refresh fallback
      });
      toast.success("Tenant updated successfully.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Review registrations, approve move-ins, assign rooms, and track tenant
            status.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-border/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="text-xl font-bold text-foreground">{summary.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Pending
              </p>
              <p className="text-xl font-bold text-foreground">{summary.pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active
              </p>
              <p className="text-xl font-bold text-foreground">{summary.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10">
              <UserX className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Moved Out
              </p>
              <p className="text-xl font-bold text-foreground">
                {summary.moved_out}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/70">
        <CardContent className="grid gap-2 p-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, room, or property"
              className="pl-8"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm"
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
            >
              <option value="all">All properties</option>
              {hostels.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <User className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No tenants found
          </p>
          <p className="text-xs text-muted-foreground/70">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTenants.map((tenant) => {
            const isEditing = editingId === tenant.id;
            const draft = drafts[tenant.id];
            const initials = tenant.full_name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <Card
                key={tenant.id}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-shadow duration-150",
                  isEditing
                    ? "border-primary/30 shadow-md shadow-primary/5"
                    : "border-border/70 hover:border-border hover:shadow-sm",
                )}
              >
                {/* ── Tenant identity row ── */}
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch">
                    {/* Left: avatar + status bar */}
                    <div className="flex items-center gap-4 border-b border-border/60 px-4 py-4 sm:border-b-0 sm:border-r sm:py-5">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                          AVATAR_BG[tenant.status],
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {tenant.full_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {tenant.email ?? "No email on file"}
                        </p>
                        {tenant.phone ? (
                          <p className="text-[11px] text-muted-foreground">
                            {tenant.phone}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Right: property / dates / actions */}
                    <div className="flex flex-1 flex-col justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                          {tenant.hostel_name}
                          {tenant.room_number ? ` · Room ${tenant.room_number}` : ""}
                        </span>

                        {tenant.hostel_location ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                            {tenant.hostel_location}
                          </span>
                        ) : null}

                        {tenant.join_date ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                            Joined {formatDate(tenant.join_date)}
                          </span>
                        ) : null}

                        {tenant.agreed_rent_amount ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <IndianRupee className="h-3 w-3" />
                            {formatCurrency(tenant.agreed_rent_amount)}
                            <span className="font-normal text-muted-foreground">
                              /mo
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {/* Right side: badge + manage */}
                      <div className="flex shrink-0 items-center gap-2.5">
                        <Badge
                          className={cn(
                            "text-[11px]",
                            STATUS_CHIP_CLASS[tenant.status],
                          )}
                        >
                          {statusLabel(tenant.status)}
                        </Badge>

                        {!isEditing ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-border px-3 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                            onClick={() => startEdit(tenant)}
                          >
                            Manage
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Manage panel ── */}
                  {isEditing && draft ? (
                    <div className="border-t border-primary/15 bg-gradient-to-br from-primary/[0.03] to-background px-4 pb-5 pt-4">
                      {/* Section: Contact */}
                      <div className="mb-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                          Contact Details
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`name-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Full Name
                            </Label>
                            <Input
                              id={`name-${tenant.id}`}
                              value={draft.fullName}
                              onChange={(e) =>
                                updateDraft(tenant.id, "fullName", e.target.value)
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`phone-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Phone Number
                            </Label>
                            <Input
                              id={`phone-${tenant.id}`}
                              value={draft.phone}
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "phone",
                                  normalizePhone(e.target.value),
                                )
                              }
                              placeholder="10-digit number"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mb-4 border-t border-border/50" />

                      {/* Section: Stay & Billing */}
                      <div className="mb-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                          Stay &amp; Billing
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {/* Status */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`status-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Status
                            </Label>
                            <select
                              id={`status-${tenant.id}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              value={draft.status}
                              disabled={savingId === tenant.id}
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "status",
                                  e.target.value as TenantStatus,
                                )
                              }
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Room */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`room-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Room Assignment
                            </Label>
                            <select
                              id={`room-${tenant.id}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={draft.roomId ?? ""}
                              disabled={
                                savingId === tenant.id || draft.status !== "active"
                              }
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "roomId",
                                  e.target.value || null,
                                )
                              }
                            >
                              <option value="">
                                {draft.status === "active"
                                  ? "Select a room"
                                  : "N/A for this status"}
                              </option>
                              {availableRooms(tenant).map((room) => (
                                <option key={room.id} value={room.id}>
                                  Room {room.room_number}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Agreed Rent */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`rent-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Agreed Rent
                              {draft.status === "active" && (
                                <span className="ml-1 text-rose-500">*</span>
                              )}
                            </Label>
                            <div className="relative">
                              <IndianRupee className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                id={`rent-${tenant.id}`}
                                value={draft.agreedRentAmount}
                                onChange={(e) =>
                                  updateDraft(
                                    tenant.id,
                                    "agreedRentAmount",
                                    normalizeRentInput(e.target.value),
                                  )
                                }
                                placeholder="Monthly rent"
                                disabled={savingId === tenant.id}
                                className={cn(
                                  "h-9 pl-8 text-sm",
                                  draft.status === "active" &&
                                    !draft.agreedRentAmount
                                    ? "border-amber-400 focus-visible:ring-amber-400"
                                    : "",
                                )}
                              />
                            </div>
                          </div>

                          {/* Join Date */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`join-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Join Date
                            </Label>
                            <Input
                              id={`join-${tenant.id}`}
                              type="date"
                              value={draft.joinDate}
                              disabled={
                                savingId === tenant.id || draft.status !== "active"
                              }
                              onChange={(e) =>
                                updateDraft(tenant.id, "joinDate", e.target.value)
                              }
                              className="h-9 text-sm disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Activation hints */}
                        {draft.status === "active" &&
                        (!draft.roomId || !draft.agreedRentAmount) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {!draft.roomId && (
                              <p className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                Room assignment is required to activate.
                              </p>
                            )}
                            {!draft.agreedRentAmount && (
                              <p className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                                <IndianRupee className="h-3 w-3" />
                                Agreed rent amount is required to activate.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Section: Move-out Date (conditional) */}
                      {draft.status === "moved_out" ? (
                        <>
                          <div className="mb-4 border-t border-border/50" />
                          <div className="mb-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                              Move-out
                            </p>
                            <div className="sm:max-w-xs">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor={`moveout-${tenant.id}`}
                                  className="text-xs font-medium"
                                >
                                  Move-out Date
                                </Label>
                                <Input
                                  id={`moveout-${tenant.id}`}
                                  type="date"
                                  value={draft.moveOutDate}
                                  disabled={savingId === tenant.id}
                                  onChange={(e) =>
                                    updateDraft(
                                      tenant.id,
                                      "moveOutDate",
                                      e.target.value,
                                    )
                                  }
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {/* Footer actions */}
                      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Changes will be saved immediately and reflect in tenant
                          portal.
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg px-3.5 text-xs"
                            disabled={savingId === tenant.id}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg px-3.5 text-xs font-medium"
                            disabled={savingId === tenant.id}
                            onClick={() => saveTenant(tenant)}
                          >
                            {savingId === tenant.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
