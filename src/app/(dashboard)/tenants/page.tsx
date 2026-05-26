"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileImage,
  IndianRupee,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  first_activated_at: string | null;
  profile_photo_url: string | null;
  profile_completion_percentage: number;
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
  capacity: number;
  occupancy: number;
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

type TenantProfileDetail = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  room_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  occupation_type: string | null;
  institution_name: string | null;
  aadhar_number: string | null;
  profile_photo_url: string | null;
  aadhar_front_url: string | null;
  aadhar_back_url: string | null;
  alternate_id_url: string | null;
  profile_completion_percentage: number;
  profile_completion_missing: string[];
  agreed_rent_amount: number | null;
  join_date: string | null;
  move_out_date: string | null;
  first_activated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovalDraft = {
  roomId: string;
  agreedRentAmount: string;
  joinDate: string;
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTenantId, setReviewTenantId] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTenant, setReviewTenant] = useState<TenantProfileDetail | null>(null);
  const [approveSaving, setApproveSaving] = useState(false);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>({
    roomId: "",
    agreedRentAmount: "",
    joinDate: "",
  });

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentTenantId, setRecordPaymentTenantId] = useState<string | null>(
    null,
  );
  const [paymentRecordingSaving, setPaymentRecordingSaving] = useState(false);
  const [paymentRecordingDraft, setPaymentRecordingDraft] = useState<{
    amount: string;
    startDate: string;
    endDate: string;
    method: string;
    notes: string;
    status: "pending" | "paid" | "overdue" | "disputed";
  }>({
    amount: "",
    startDate: "",
    endDate: "",
    method: "cash",
    notes: "",
    status: "paid",
  });

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

  function allRoomsForHostel(hostelId: string, currentRoomId: string | null = null) {
    const allRooms = roomsByHostel[hostelId] ?? [];
    return allRooms.sort((a, b) => {
      // Current room first, then sort by room number in ascending order
      if (a.id === currentRoomId) return -1;
      if (b.id === currentRoomId) return 1;
      const aNum = parseInt(a.room_number) || 0;
      const bNum = parseInt(b.room_number) || 0;
      return aNum - bNum;
    });
  }

  async function saveTenant(tenant: TenantRow) {
    const draft = drafts[tenant.id];
    if (!draft) {
      toast.error("Edit form not ready. Please try again.");
      return;
    }

    if (!draft.fullName || !draft.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    if (!draft.phone || !/^\d{10}$/.test(draft.phone.replace(/\D/g, ""))) {
      toast.error("Valid 10-digit phone number is required.");
      return;
    }

    if (!draft.roomId) {
      toast.error("Room assignment is required.");
      return;
    }

    if (!draft.agreedRentAmount) {
      toast.error("Agreed rent amount is required.");
      return;
    }

    if (!draft.joinDate) {
      toast.error("Join date is required.");
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
              first_activated_at: string | null;
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
              first_activated_at: row.first_activated_at,
              profile_completion_percentage: row.profile_completion_percentage,
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
            first_activated_at: updatedTenant.first_activated_at,
            profile_completion_percentage: row.profile_completion_percentage,
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

  function maskAadhaar(value: string | null) {
    if (!value || value.length < 4) {
      return "-";
    }
    return `XXXX XXXX ${value.slice(-4)}`;
  }

  async function openReview(tenant: TenantRow) {
    setReviewOpen(true);
    setReviewTenantId(tenant.id);
    setReviewLoading(true);
    setReviewTenant(null);

    setApprovalDraft({
      roomId: tenant.room_id ?? "",
      agreedRentAmount:
        tenant.agreed_rent_amount !== null ? String(tenant.agreed_rent_amount) : "",
      joinDate: tenant.join_date ?? "",
    });

    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as
        | { error?: string }
        | { tenant?: TenantProfileDetail };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not load tenant profile.");
        return;
      }

      const profile = "tenant" in json ? json.tenant : undefined;
      if (!profile) {
        toast.error("Could not load tenant profile.");
        return;
      }

      setReviewTenant(profile);
      setApprovalDraft((prev) => ({
        roomId: profile.room_id ?? prev.roomId,
        agreedRentAmount:
          profile.agreed_rent_amount !== null
            ? String(profile.agreed_rent_amount)
            : prev.agreedRentAmount,
        joinDate: profile.join_date ?? prev.joinDate,
      }));
    } catch {
      toast.error("Network error while loading tenant profile.");
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReview(open: boolean) {
    setReviewOpen(open);
    if (!open) {
      setReviewLoading(false);
      setReviewTenantId(null);
      setReviewTenant(null);
      setApproveSaving(false);
    }
  }

  async function approveTenantProfile() {
    if (!reviewTenantId || !reviewTenant) {
      return;
    }

    if (!approvalDraft.roomId) {
      toast.error("Assign a room to approve this tenant.");
      return;
    }

    if (!approvalDraft.agreedRentAmount) {
      toast.error("Add agreed rent to approve this tenant.");
      return;
    }

    setApproveSaving(true);
    try {
      const response = await fetch(`/api/tenants/${reviewTenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          roomId: approvalDraft.roomId,
          agreedRentAmount: Number(approvalDraft.agreedRentAmount),
          joinDate: approvalDraft.joinDate || null,
        }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Could not approve tenant.");
        return;
      }

      toast.success("Tenant profile approved and activated.");
      await loadTenants();
      closeReview(false);
    } catch {
      toast.error("Network error while approving tenant.");
    } finally {
      setApproveSaving(false);
    }
  }

  function openRecordPayment(tenant: TenantRow) {
    setRecordPaymentOpen(true);
    setRecordPaymentTenantId(tenant.id);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDateStr = firstDay.toISOString().split("T")[0];
    const endDateStr = lastDay.toISOString().split("T")[0];
    setPaymentRecordingDraft({
      amount: tenant.agreed_rent_amount ? String(tenant.agreed_rent_amount) : "",
      startDate: startDateStr,
      endDate: endDateStr,
      method: "cash",
      notes: "",
      status: "paid",
    });
  }

  function closeRecordPayment() {
    setRecordPaymentOpen(false);
    setRecordPaymentTenantId(null);
    setPaymentRecordingDraft({
      amount: "",
      startDate: "",
      endDate: "",
      method: "cash",
      notes: "",
      status: "paid",
    });
  }

  async function savePaymentRecord() {
    if (!recordPaymentTenantId) {
      toast.error("Tenant not selected.");
      return;
    }

    const amount = parseFloat(paymentRecordingDraft.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    if (!paymentRecordingDraft.startDate || !paymentRecordingDraft.endDate) {
      toast.error("Select a billing period.");
      return;
    }

    setPaymentRecordingSaving(true);
    try {
      const tenant = tenants.find((t) => t.id === recordPaymentTenantId);
      const startDate = new Date(paymentRecordingDraft.startDate);
      const month = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      const payload = {
        tenant_id: recordPaymentTenantId,
        hostel_id: tenant?.hostel_id,
        amount,
        month,
        method: paymentRecordingDraft.method || null,
        notes: paymentRecordingDraft.notes.trim() || null,
        status: paymentRecordingDraft.status,
      };

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Could not record payment.");
        return;
      }

      toast.success("Payment recorded successfully.");
      closeRecordPayment();
      loadTenants().catch(() => {
        // fallback
      });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPaymentRecordingSaving(false);
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
                    <div className="flex items-center gap-4 border-b border-border/60 px-4 py-4 sm:w-[250px] sm:flex-none sm:border-b-0 sm:border-r sm:py-5">
                      <button
                        type="button"
                        onClick={() => openReview(tenant)}
                        className="rounded-xl transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Open ${tenant.full_name} profile review`}
                      >
                        {tenant.profile_photo_url ? (
                          <Image
                            src={tenant.profile_photo_url}
                            alt={`${tenant.full_name} profile`}
                            width={44}
                            height={44}
                            className="h-11 w-11 rounded-xl object-cover shadow-sm"
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                              AVATAR_BG[tenant.status],
                            )}
                          >
                            {initials}
                          </div>
                        )}
                      </button>
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
                    <div className="flex flex-1 flex-col justify-start gap-3 px-4 py-3.5">
                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                          {tenant.hostel_name}
                          {tenant.room_number ? ` · Room ${tenant.room_number}` : ""}
                        </span>

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

                      {/* Right side: badges on top, buttons below */}
                      <div className="flex flex-col gap-2.5">
                        {/* Row 1: Profile % and Status chips */}
                        <div className="flex shrink-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              tenant.profile_completion_percentage >= 100
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
                            )}
                          >
                            Profile {tenant.profile_completion_percentage}%
                          </span>
                          <Badge
                            className={cn(
                              "text-[11px]",
                              STATUS_CHIP_CLASS[tenant.status],
                            )}
                          >
                            {statusLabel(tenant.status)}
                          </Badge>
                        </div>

                        {/* Row 2: Action buttons */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-border px-3 text-xs font-medium"
                            onClick={() => openReview(tenant)}
                          >
                            Review Profile
                          </Button>

                          {!isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-border px-3 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                onClick={() => startEdit(tenant)}
                              >
                                Manage
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-border px-3 text-xs font-medium gap-1.5 hover:border-emerald-400/40 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
                                onClick={() => openRecordPayment(tenant)}
                                disabled={tenant.status !== "active"}
                                title={
                                  tenant.status !== "active"
                                    ? "Tenant must be active to record payments"
                                    : ""
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Payment
                              </Button>
                            </>
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
                              <span className="ml-1 text-rose-500">*</span>
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
                              <span className="ml-1 text-rose-500">*</span>
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
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <select
                              id={`room-${tenant.id}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={draft.roomId ?? ""}
                              disabled={savingId === tenant.id}
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "roomId",
                                  e.target.value || null,
                                )
                              }
                            >
                              <option value="">Select a room</option>
                              {(roomsByHostel[tenant.hostel_id] ?? [])
                                .sort((a, b) => {
                                  const aNum = parseInt(a.room_number) || 0;
                                  const bNum = parseInt(b.room_number) || 0;
                                  return aNum - bNum;
                                })
                                .map((room) => {
                                  const available = room.capacity - room.occupancy;
                                  const isFull = available === 0;
                                  return (
                                    <option
                                      key={room.id}
                                      value={room.id}
                                      disabled={isFull}
                                    >
                                      Room {room.room_number} ({room.occupancy}/
                                      {room.capacity}){isFull ? " - FULL" : ""}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>

                          {/* Agreed Rent */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`rent-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Agreed Rent per month
                              <span className="ml-1 text-rose-500">*</span>
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
                                className="h-9 pl-8 text-sm"
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
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <Input
                              id={`join-${tenant.id}`}
                              type="date"
                              value={draft.joinDate}
                              disabled={savingId === tenant.id}
                              onChange={(e) =>
                                updateDraft(tenant.id, "joinDate", e.target.value)
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
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

      <Dialog open={reviewOpen} onOpenChange={closeReview}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tenant Profile Review</DialogTitle>
            <DialogDescription>
              Review complete profile and uploaded documents before approving this
              tenant as active.
            </DialogDescription>
          </DialogHeader>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !reviewTenant ? (
            <p className="text-sm text-muted-foreground">
              Unable to load tenant profile.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border/70 p-4 sm:grid-cols-[84px_1fr]">
                {reviewTenant.profile_photo_url ? (
                  <Image
                    src={reviewTenant.profile_photo_url}
                    alt={`${reviewTenant.full_name} profile photo`}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                    {reviewTenant.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {reviewTenant.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.email ?? "No email"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.phone ?? "No phone"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.hostel_name}
                    {reviewTenant.hostel_location
                      ? `, ${reviewTenant.hostel_location}`
                      : ""}
                  </p>
                  <div className="pt-1">
                    <Badge
                      className={cn(
                        "text-[11px]",
                        STATUS_CHIP_CLASS[reviewTenant.status],
                      )}
                    >
                      {statusLabel(reviewTenant.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Occupation</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.occupation_type ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Institution</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.institution_name ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aadhaar</p>
                  <p className="text-sm font-medium text-foreground">
                    {maskAadhaar(reviewTenant.aadhar_number)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profile Completion</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.profile_completion_percentage}%
                  </p>
                </div>
              </div>

              {reviewTenant.profile_completion_missing.length > 0 ? (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                  Missing: {reviewTenant.profile_completion_missing.join(", ")}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Uploaded Documents
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Aadhaar Front",
                      url: reviewTenant.aadhar_front_url,
                    },
                    {
                      label: "Aadhaar Back",
                      url: reviewTenant.aadhar_back_url,
                    },
                    {
                      label: "Alternate ID",
                      url: reviewTenant.alternate_id_url,
                    },
                  ].map((doc) => (
                    <div
                      key={doc.label}
                      className="rounded-lg border border-border/70 p-2"
                    >
                      <p className="mb-2 text-xs font-medium text-foreground">
                        {doc.label}
                      </p>
                      {doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <Image
                            src={doc.url}
                            alt={doc.label}
                            width={240}
                            height={112}
                            className="h-28 w-full rounded-md object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex h-28 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                          <FileImage className="mr-1 h-3.5 w-3.5" /> Not uploaded
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Approval
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="approval-room" className="text-xs">
                      Room
                    </Label>
                    <select
                      id="approval-room"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                      value={approvalDraft.roomId}
                      onChange={(e) =>
                        setApprovalDraft((prev) => ({
                          ...prev,
                          roomId: e.target.value,
                        }))
                      }
                      disabled={approveSaving || reviewTenant.status === "active"}
                    >
                      <option value="">Select room</option>
                      {allRoomsForHostel(
                        reviewTenant.hostel_id,
                        reviewTenant.room_id,
                      ).map((room) => {
                        const available = room.capacity - room.occupancy;
                        const isFull = available === 0;
                        return (
                          <option key={room.id} value={room.id}>
                            Room {room.room_number} ({room.occupancy}/{room.capacity}
                            )
                            {isFull
                              ? " - FULL"
                              : available > 0
                                ? ` - ${available} bed${available > 1 ? "s" : ""} available`
                                : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="approval-rent" className="text-xs">
                      Agreed Rent Per Month
                    </Label>
                    <Input
                      id="approval-rent"
                      value={approvalDraft.agreedRentAmount}
                      onChange={(e) =>
                        setApprovalDraft((prev) => ({
                          ...prev,
                          agreedRentAmount: normalizeRentInput(e.target.value),
                        }))
                      }
                      disabled={approveSaving || reviewTenant.status === "active"}
                      className="mt-1 h-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="approval-join-date" className="text-xs">
                      Join Date
                    </Label>
                    <Input
                      id="approval-join-date"
                      type="date"
                      value={approvalDraft.joinDate}
                      onChange={(e) =>
                        setApprovalDraft((prev) => ({
                          ...prev,
                          joinDate: e.target.value,
                        }))
                      }
                      disabled={approveSaving || reviewTenant.status === "active"}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={approveTenantProfile}
                    disabled={approveSaving || reviewTenant.status === "active"}
                  >
                    {approveSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : reviewTenant.status === "active" ? (
                      "Already Active"
                    ) : (
                      "Approve As Active"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for{" "}
              {recordPaymentTenantId
                ? tenants.find((t) => t.id === recordPaymentTenantId)?.full_name
                : "tenant"}
            </DialogDescription>
          </DialogHeader>

          {recordPaymentTenantId &&
            tenants.find((t) => t.id === recordPaymentTenantId) && (
              <div className="space-y-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <Label htmlFor="payment-amount" className="text-xs font-medium">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={paymentRecordingDraft.amount}
                    onChange={(e) =>
                      setPaymentRecordingDraft((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    disabled={paymentRecordingSaving}
                  />
                </div>

                {/* Billing Period */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Billing Period</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="payment-start-date"
                        className="text-xs text-muted-foreground"
                      >
                        Start Date <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="payment-start-date"
                        type="date"
                        value={paymentRecordingDraft.startDate}
                        onChange={(e) =>
                          setPaymentRecordingDraft((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        disabled={paymentRecordingSaving}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="payment-end-date"
                        className="text-xs text-muted-foreground"
                      >
                        End Date <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="payment-end-date"
                        type="date"
                        value={paymentRecordingDraft.endDate}
                        onChange={(e) =>
                          setPaymentRecordingDraft((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        disabled={paymentRecordingSaving}
                      />
                    </div>
                  </div>
                </div>

                {/* Method + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-method" className="text-xs font-medium">
                      Payment Method
                    </Label>
                    <select
                      id="payment-method"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={paymentRecordingDraft.method}
                      onChange={(e) =>
                        setPaymentRecordingDraft((prev) => ({
                          ...prev,
                          method: e.target.value,
                        }))
                      }
                      disabled={paymentRecordingSaving}
                    >
                      <option value="">Not specified</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment-status" className="text-xs font-medium">
                      Status
                    </Label>
                    <select
                      id="payment-status"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={paymentRecordingDraft.status}
                      onChange={(e) =>
                        setPaymentRecordingDraft((prev) => ({
                          ...prev,
                          status: e.target.value as "paid" | "disputed",
                        }))
                      }
                      disabled={paymentRecordingSaving}
                    >
                      <option value="paid">Paid</option>
                      <option value="disputed">Disputed</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="payment-notes" className="text-xs font-medium">
                    Notes (optional)
                  </Label>
                  <Input
                    id="payment-notes"
                    placeholder="e.g. Partial payment, paid via UPI ref #123…"
                    value={paymentRecordingDraft.notes}
                    onChange={(e) =>
                      setPaymentRecordingDraft((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    maxLength={1000}
                    disabled={paymentRecordingSaving}
                  />
                </div>

                {paymentRecordingDraft.status === "paid" && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    A receipt number will be auto-generated and assigned.
                  </p>
                )}
              </div>
            )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeRecordPayment}
              disabled={paymentRecordingSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={savePaymentRecord}
              disabled={paymentRecordingSaving || !recordPaymentTenantId}
              className="gap-1.5"
            >
              {paymentRecordingSaving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
