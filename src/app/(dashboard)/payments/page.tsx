"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PaymentStatus = "pending" | "paid" | "overdue" | "disputed";
type PaymentMethod = "cash" | "upi" | "bank_transfer" | "razorpay" | "other";

type PaymentRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  room_number: string | null;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  amount: number;
  month: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  receipt_number: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type TenantOption = {
  id: string;
  full_name: string;
  hostel_id: string;
  hostel_name: string;
  room_number: string | null;
  agreed_rent_amount: number | null;
  status: string;
};

type HostelOption = {
  id: string;
  name: string;
  location: string | null;
};

type PaymentSummary = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  disputed: number;
};

type RecordDraft = {
  tenant_id: string;
  hostel_id: string;
  amount: string;
  month: string;
  method: PaymentMethod | "";
  notes: string;
  status: PaymentStatus;
};

type EditDraft = {
  status: PaymentStatus;
  method: PaymentMethod | "";
  notes: string;
  amount: string;
};

const EMPTY_DRAFT: RecordDraft = {
  tenant_id: "",
  hostel_id: "",
  amount: "",
  month: "",
  method: "cash",
  notes: "",
  status: "paid",
};

const STATUS_CHIP: Record<PaymentStatus, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  overdue:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  disputed:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay",
  other: "Other",
};

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Build month options: current month + 11 prior months
function buildMonthOptions() {
  const opts: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();

export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    disputed: 0,
  });
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | PaymentStatus>("all");
  const [filterMonth, setFilterMonth] = useState("all");

  // Record modal
  const [recordOpen, setRecordOpen] = useState(false);
  const [draft, setDraft] = useState<RecordDraft>({
    ...EMPTY_DRAFT,
    month: currentMonthValue(),
  });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    status: "paid",
    method: "",
    notes: "",
    amount: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load payments.");
        return;
      }
      const rows = (json.payments ?? []) as PaymentRow[];
      setPayments(rows);
      setSummary(
        json.summary ?? { total: 0, paid: 0, pending: 0, overdue: 0, disputed: 0 },
      );

      const seen = new Set<string>();
      const opts: HostelOption[] = [];
      for (const row of rows) {
        if (!seen.has(row.hostel_id)) {
          seen.add(row.hostel_id);
          opts.push({
            id: row.hostel_id,
            name: row.hostel_name,
            location: row.hostel_location,
          });
        }
      }
      setHostels(opts);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTenants() {
    setTenantsLoading(true);
    try {
      const res = await fetch("/api/tenants", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      type TenantApiRow = {
        id: string;
        full_name: string;
        hostel_id: string;
        hostel_name: string;
        room_number: string | null;
        agreed_rent_amount: number | null;
        status: string;
      };
      const activeTenants = ((json.tenants ?? []) as TenantApiRow[]).filter(
        (t) => t.status === "active",
      );
      setTenants(
        activeTenants.map((t) => ({
          id: t.id,
          full_name: t.full_name,
          hostel_id: t.hostel_id,
          hostel_name: t.hostel_name,
          room_number: t.room_number,
          agreed_rent_amount: t.agreed_rent_amount,
          status: t.status,
        })),
      );

      // Also collect hostels from tenants data for the create dropdown
      const seenH = new Set<string>(hostels.map((h) => h.id));
      const extraHostels: HostelOption[] = [];
      for (const t of activeTenants) {
        if (!seenH.has(t.hostel_id)) {
          seenH.add(t.hostel_id);
          extraHostels.push({
            id: t.hostel_id,
            name: t.hostel_name,
            location: null,
          });
        }
      }
      if (extraHostels.length) {
        setHostels((prev) =>
          Array.from(
            new Map([...prev, ...extraHostels].map((h) => [h.id, h])).values(),
          ),
        );
      }
    } catch {
      // silent
    } finally {
      setTenantsLoading(false);
    }
  }

  useEffect(() => {
    loadPayments().catch(() => {
      // handled
    });
  }, []);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterHostelId !== "all" && p.hostel_id !== filterHostelId) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterMonth !== "all") {
        const rowMonth = p.month.slice(0, 7); // "YYYY-MM"
        if (rowMonth !== filterMonth) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !p.tenant_name.toLowerCase().includes(q) &&
          !(p.room_number ?? "").toLowerCase().includes(q) &&
          !(p.receipt_number ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [payments, filterHostelId, filterStatus, filterMonth, searchQuery]);

  // Unique months available in current data
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: Array<{ value: string; label: string }> = [];
    for (const p of payments) {
      const m = p.month.slice(0, 7);
      if (!seen.has(m)) {
        seen.add(m);
        months.push({
          value: m,
          label: new Date(`${m}-01`).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          }),
        });
      }
    }
    return months;
  }, [payments]);

  function openRecordModal() {
    loadTenants().catch(() => {});
    setDraft({ ...EMPTY_DRAFT, month: currentMonthValue() });
    setRecordOpen(true);
  }

  function closeRecordModal() {
    setRecordOpen(false);
  }

  // When tenant changes in draft, auto-fill amount from agreed_rent_amount
  function handleTenantChange(tenantId: string) {
    const found = tenants.find((t) => t.id === tenantId);
    setDraft((d) => ({
      ...d,
      tenant_id: tenantId,
      hostel_id: found?.hostel_id ?? d.hostel_id,
      amount: found?.agreed_rent_amount
        ? String(found.agreed_rent_amount)
        : d.amount,
    }));
  }

  async function handleRecord() {
    const amount = parseFloat(draft.amount);
    if (!draft.tenant_id) {
      toast.error("Please select a tenant.");
      return;
    }
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!draft.month) {
      toast.error("Please select a month.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: draft.tenant_id,
          hostel_id: draft.hostel_id,
          amount,
          month: draft.month,
          method: draft.method || null,
          notes: draft.notes.trim() || null,
          status: draft.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not record payment.");
        return;
      }
      const newPayment = json.payment as PaymentRow;
      setPayments((prev) => [newPayment, ...prev]);
      setSummary((prev) => ({
        ...prev,
        total: prev.total + Number(newPayment.amount),
        [newPayment.status]:
          (prev[newPayment.status] ?? 0) + Number(newPayment.amount),
      }));
      toast.success("Payment recorded.");
      closeRecordModal();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(payment: PaymentRow) {
    setEditingId(payment.id);
    setEditDraft({
      status: payment.status,
      method: payment.method ?? "",
      notes: payment.notes ?? "",
      amount: String(payment.amount),
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editingId) return;
    const amount = parseFloat(editDraft.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const current = payments.find((p) => p.id === editingId);
    const payload: Record<string, unknown> = {};
    if (current && editDraft.status !== current.status)
      payload.status = editDraft.status;
    if (current && (editDraft.method || null) !== current.method)
      payload.method = editDraft.method || null;
    if (current && (editDraft.notes.trim() || null) !== current.notes)
      payload.notes = editDraft.notes.trim() || null;
    if (current && amount !== Number(current.amount)) payload.amount = amount;

    if (Object.keys(payload).length === 0) {
      toast.info("No changes made.");
      setEditOpen(false);
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/payments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update payment.");
        return;
      }
      const updated = json.payment as PaymentRow;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                status: updated.status,
                method: updated.method,
                notes: updated.notes,
                amount: updated.amount,
                paid_at: updated.paid_at,
                receipt_number: updated.receipt_number,
                updated_at: updated.updated_at,
              }
            : p,
        ),
      );
      toast.success("Payment updated.");
      setEditOpen(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(paymentId: string) {
    setDeletingId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete payment.");
        return;
      }
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      toast.success("Payment deleted.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Payments
            </h2>
            <p className="text-sm text-muted-foreground">
              Record and track rent payments from tenants.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={openRecordModal}>
          <Plus className="h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatAmount(summary.paid)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">Pending</p>
            <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">
              {formatAmount(summary.pending)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
            <p className="text-xs text-rose-700 dark:text-rose-400">Overdue</p>
            <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">
              {formatAmount(summary.overdue)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
            <p className="text-xs text-violet-700 dark:text-violet-400">Disputed</p>
            <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
              {formatAmount(summary.disputed)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && payments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8 text-sm"
              placeholder="Search tenant, receipt…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {hostels.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={filterHostelId}
              onChange={(e) => setFilterHostelId(e.target.value)}
            >
              <option value="all">All Properties</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}

          {availableMonths.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1">
            {(["all", "paid", "pending", "overdue", "disputed"] as const).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "h-9 rounded-md px-3 text-xs font-medium capitalize transition-colors",
                    filterStatus === s
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <IndianRupee className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              No payments recorded yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record your first payment to start tracking rent collection.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openRecordModal}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IndianRupee className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No payments match your filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterHostelId("all");
              setFilterStatus("all");
              setFilterMonth("all");
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((payment) => (
            <Card
              key={payment.id}
              className={cn(
                "rounded-2xl border transition-colors",
                payment.status === "overdue"
                  ? "border-rose-200/70 dark:border-rose-500/20"
                  : "border-border/70",
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {payment.tenant_name}
                        </span>
                        {payment.room_number && (
                          <span className="text-xs text-muted-foreground">
                            Room {payment.room_number}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 text-[11px]",
                            STATUS_CHIP[payment.status],
                          )}
                        >
                          {payment.status === "paid" && (
                            <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                          )}
                          {payment.status.charAt(0).toUpperCase() +
                            payment.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatMonth(payment.month)}
                        </span>
                        <span className="flex items-center gap-1">
                          <BadgeIndianRupee className="h-3 w-3" />
                          {formatAmount(Number(payment.amount))}
                          {payment.method && ` · ${METHOD_LABEL[payment.method]}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {payment.hostel_name}
                        </span>
                        {payment.receipt_number && (
                          <span className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            {payment.receipt_number}
                          </span>
                        )}
                      </div>

                      {payment.notes && (
                        <p className="text-xs text-muted-foreground">
                          Note: {payment.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditModal(payment)}
                      title="Edit payment"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {confirmDeleteId === payment.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Sure?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={deletingId === payment.id}
                          onClick={() => handleDelete(payment.id)}
                        >
                          {deletingId === payment.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Yes"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500/50 dark:hover:text-rose-400"
                        onClick={() => setConfirmDeleteId(payment.id)}
                        title="Delete payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Record Payment Modal */}
      {recordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRecordModal();
          }}
        >
          <div className="w-full max-w-lg rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Record Payment
              </h3>
              <button
                type="button"
                onClick={closeRecordModal}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tenant */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tenant</Label>
                {tenantsLoading ? (
                  <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading tenants…
                  </div>
                ) : tenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active tenants found.
                  </p>
                ) : (
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.tenant_id}
                    onChange={(e) => handleTenantChange(e.target.value)}
                  >
                    <option value="">Select a tenant…</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                        {t.room_number ? ` — Room ${t.room_number}` : ""}
                        {` (${t.hostel_name})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Month + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Month</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.month}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, month: e.target.value }))
                    }
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, amount: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Method + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Method</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.method}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        method: e.target.value as PaymentMethod | "",
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as PaymentStatus,
                      }))
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Partial payment, paid via UPI ref #123…"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  maxLength={1000}
                />
              </div>

              {draft.status === "paid" && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  A receipt number will be auto-generated and assigned.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={closeRecordModal}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecord}
                disabled={saving || tenantsLoading}
                className="gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Edit Payment
              </h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDraft.amount}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, amount: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editDraft.status}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        status: e.target.value as PaymentStatus,
                      }))
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Method</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editDraft.method}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        method: e.target.value as PaymentMethod | "",
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Input
                  placeholder="Add a note…"
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  maxLength={1000}
                />
              </div>

              {editDraft.status === "paid" &&
                (() => {
                  const current = payments.find((p) => p.id === editingId);
                  if (current && current.status !== "paid") {
                    return (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Receipt number will be auto-generated on save.
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(false)}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={editSaving}
                className="gap-1.5"
              >
                {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
