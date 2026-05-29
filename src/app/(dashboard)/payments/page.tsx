"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  BadgeIndianRupee,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileDown,
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
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { DateRangePicker, DateRange } from "@/components/ui/DateRangePicker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { calculateRent, type RentCalculation } from "@/lib/billing";

type PaymentStatus = "paid" | "disputed";
type PaymentMethod = "cash" | "upi" | "bank_transfer" | "razorpay" | "other";

type PaymentRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  room_number: string | null;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  hostel_address?: string | null;
  hostel_city?: string | null;
  hostel_state?: string | null;
  hostel_pincode?: string | null;
  hostel_billing_address?: string | null;
  hostel_gst_number?: string | null;
  hostel_pan_number?: string | null;
  amount: number;
  month: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  receipt_number: string | null;
  notes: string | null;
  paid_at: string | null;
  paid_on: string;
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
  rent_start_date?: string | null;
  join_date?: string | null;
};

type HostelOption = {
  id: string;
  name: string;
  location: string | null;
};

type RecordDraft = {
  tenant_id: string;
  hostel_id: string;
  amount: string;
  startDate: string;
  endDate: string;
  method: PaymentMethod | "";
  notes: string;
  status: PaymentStatus;
  paid_on: string;
};

type EditDraft = {
  status: PaymentStatus;
  method: PaymentMethod | "";
  notes: string;
  amount: string;
  paid_on: string;
};

const STATUS_CHIP: Record<PaymentStatus, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
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

function formatBillingPeriod(dateStr: string) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthName = date.toLocaleDateString("en-IN", { month: "short" });
  return `1–${lastDay} ${monthName} ${year}`;
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function toLocalISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getMonthEndDate(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return toLocalISO(new Date(year, month - 1, lastDay));
}

function getNextBillingPeriod(
  tenant?: TenantOption,
  paymentsList: PaymentRow[] = [],
) {
  if (!tenant) {
    return thisMonthRange();
  }

  const tenantPayments = paymentsList.filter(
    (payment) =>
      payment.tenant_id === tenant.id && /^\d{4}-\d{2}-\d{2}$/.test(payment.month),
  );

  if (tenantPayments.length > 0) {
    const latest = tenantPayments.reduce(
      (current, payment) => (payment.month > current.month ? payment : current),
      tenantPayments[0],
    );

    const [year, month] = latest.month.split("-").map(Number);
    const nextStart = new Date(year, month, 1);
    const startDate = toLocalISO(nextStart);
    return {
      startDate,
      endDate: getMonthEndDate(startDate),
    };
  }

  const rentStart = tenant.rent_start_date ?? tenant.join_date;
  if (!rentStart) {
    return thisMonthRange();
  }

  const [year, month, day] = rentStart.split("-").map(Number);
  if (!year || !month || !day) {
    return thisMonthRange();
  }

  const startDate = toLocalISO(new Date(year, month - 1, day));
  return {
    startDate,
    endDate: getMonthEndDate(startDate),
  };
}

function thisMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: first.toISOString().split("T")[0],
    endDate: last.toISOString().split("T")[0],
  };
}

function printInvoice(payment: PaymentRow) {
  const billingPeriod = formatBillingPeriod(payment.month);
  const methodLabel = payment.method ? METHOD_LABEL[payment.method] : "—";
  const statusLabel =
    payment.status.charAt(0).toUpperCase() + payment.status.slice(1);
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const propertyAddressParts = [
    payment.hostel_address?.trim(),
    payment.hostel_billing_address?.trim(),
    [payment.hostel_city, payment.hostel_state, payment.hostel_pincode]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const propertyAddressHtml = propertyAddressParts.length
    ? `<div class="property-address">${propertyAddressParts.join("<br />")}</div>`
    : "";

  const gstPanHtml = [
    payment.hostel_gst_number
      ? `<div class="meta-row"><div class="meta-label">GST</div><div class="meta-value">${payment.hostel_gst_number}</div></div>`
      : "",
    payment.hostel_pan_number
      ? `<div class="meta-row"><div class="meta-label">PAN</div><div class="meta-value">${payment.hostel_pan_number}</div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${payment.receipt_number ?? ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 48px 56px; max-width: 680px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .brand span { color: #6366f1; }
    .property { font-size: 13px; color: #555; margin-top: 4px; }
    .property-address { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.4; }
    .property-loc { font-size: 11px; color: #888; margin-top: 2px; }
    .meta-block { text-align: right; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #999; }
    .meta-value { font-size: 13px; font-weight: 600; margin-top: 2px; }
    .meta-value.receipt { font-size: 12px; font-family: monospace; letter-spacing: 0.5px; }
    .meta-row { margin-bottom: 10px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
    .tenant-name { font-size: 20px; font-weight: 600; }
    .tenant-sub { font-size: 13px; color: #555; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px; margin-top: 4px; }
    .detail-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #999; }
    .detail-value { font-size: 14px; font-weight: 500; margin-top: 3px; }
    .amount-box { margin-top: 28px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
    .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .amount-value { font-size: 30px; font-weight: 700; margin-top: 4px; }
    .status-pill { padding: 5px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; background: #dcfce7; color: #166534; }
    .status-pill.disputed { background: #f3e8ff; color: #6b21a8; }
    .notes { margin-top: 20px; font-size: 12px; color: #666; font-style: italic; line-height: 1.5; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px dashed #e5e7eb; font-size: 11px; color: #bbb; text-align: center; }
    @media print {
      body { padding: 24px 32px; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Nest<span>Desk</span></div>
      <div class="property">${payment.hostel_name}</div>
      <div class="property-loc">${payment.hostel_location ?? ""}</div>
      ${propertyAddressHtml}
      ${gstPanHtml}
    </div>
    <div class="meta-block">
      <div class="meta-row">
        <div class="meta-label">Receipt / Invoice</div>
        <div class="meta-value receipt">${payment.receipt_number ?? "—"}</div>
      </div>
      <div class="meta-row">
        <div class="meta-label">Date Issued</div>
        <div class="meta-value">${formatDateShort(payment.paid_on)}</div>
      </div>
    </div>
  </div>

  <hr />

  <div class="section-label">Billed To</div>
  <div class="tenant-name">${payment.tenant_name}</div>
  <div class="tenant-sub">${payment.room_number ? `Room ${payment.room_number} &middot; ` : ""}${payment.hostel_name}</div>

  <hr />

  <div class="grid">
    <div>
      <div class="detail-label">Billing Period</div>
      <div class="detail-value">${billingPeriod}</div>
    </div>
    <div>
      <div class="detail-label">Payment Date</div>
      <div class="detail-value">${formatDateShort(payment.paid_on)}</div>
    </div>
    <div>
      <div class="detail-label">Payment Method</div>
      <div class="detail-value">${methodLabel}</div>
    </div>
    <div>
      <div class="detail-label">Status</div>
      <div class="detail-value">${statusLabel}</div>
    </div>
  </div>

  <div class="amount-box">
    <div>
      <div class="amount-label">Amount Paid</div>
      <div class="amount-value">${formatAmount(Number(payment.amount))}</div>
    </div>
    <div class="status-pill ${payment.status}">${statusLabel}</div>
  </div>

  ${payment.notes ? `<div class="notes">Note: ${payment.notes}</div>` : ""}

  <div class="footer">Generated by NestDesk &middot; ${generatedOn}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked — please allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

const EMPTY_DRAFT: RecordDraft = {
  tenant_id: "",
  hostel_id: "",
  amount: "",
  startDate: "",
  endDate: "",
  method: "cash",
  notes: "",
  status: "paid",
  paid_on: todayISO(),
};

export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | PaymentStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Record modal
  const [recordOpen, setRecordOpen] = useState(false);
  const [draft, setDraft] = useState<RecordDraft>({
    ...EMPTY_DRAFT,
    ...thisMonthRange(),
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
    paid_on: todayISO(),
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Data loading                                                         */
  /* ------------------------------------------------------------------ */
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
        rent_start_date?: string | null;
        join_date?: string | null;
      };
      const active = ((json.tenants ?? []) as TenantApiRow[]).filter(
        (t) => t.status === "active",
      );
      setTenants(
        active.map((t) => ({
          id: t.id,
          full_name: t.full_name,
          hostel_id: t.hostel_id,
          hostel_name: t.hostel_name,
          room_number: t.room_number,
          agreed_rent_amount: t.agreed_rent_amount,
          status: t.status,
          rent_start_date: t.rent_start_date,
          join_date: t.join_date,
        })),
      );

      const seenH = new Set<string>(hostels.map((h) => h.id));
      const extra: HostelOption[] = [];
      for (const t of active) {
        if (!seenH.has(t.hostel_id)) {
          seenH.add(t.hostel_id);
          extra.push({ id: t.hostel_id, name: t.hostel_name, location: null });
        }
      }
      if (extra.length) {
        setHostels((prev) =>
          Array.from(new Map([...prev, ...extra].map((h) => [h.id, h])).values()),
        );
      }
    } catch {
      // silent
    } finally {
      setTenantsLoading(false);
    }
  }

  useEffect(() => {
    loadPayments().catch(() => {});
  }, []);

  /* ------------------------------------------------------------------ */
  /* Derived data                                                         */
  /* ------------------------------------------------------------------ */
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterHostelId !== "all" && p.hostel_id !== filterHostelId) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (fromDate && p.paid_on < fromDate) return false;
      if (toDate && p.paid_on > toDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !p.tenant_name.toLowerCase().includes(q) &&
          !(p.room_number ?? "").toLowerCase().includes(q) &&
          !(p.receipt_number ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [payments, filterHostelId, filterStatus, fromDate, toDate, searchQuery]);

  // This-month stats
  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = payments.filter((p) => p.paid_on.startsWith(yyyyMM));

    const byHostel = new Map<
      string,
      { name: string; paid: number; count: number }
    >();
    let totalPaid = 0;
    let totalCount = 0;
    let disputedAmt = 0;

    for (const p of thisMonth) {
      if (p.status === "paid") {
        totalPaid += Number(p.amount);
        totalCount += 1;
        const h = byHostel.get(p.hostel_id) ?? {
          name: p.hostel_name,
          paid: 0,
          count: 0,
        };
        h.paid += Number(p.amount);
        h.count += 1;
        byHostel.set(p.hostel_id, h);
      } else if (p.status === "disputed") {
        disputedAmt += Number(p.amount);
      }
    }

    return {
      totalPaid,
      totalCount,
      disputedAmt,
      byHostel,
      monthLabel: now.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [payments]);

  const hasActiveFilters =
    filterHostelId !== "all" ||
    filterStatus !== "all" ||
    !!fromDate ||
    !!toDate ||
    !!searchQuery;

  // Billing calculation preview — shown in record modal when tenant + dates are set
  const billingPreview = useMemo<RentCalculation | null>(() => {
    const tenant = tenants.find((t) => t.id === draft.tenant_id);
    if (!tenant?.agreed_rent_amount || !draft.startDate || !draft.endDate)
      return null;
    if (draft.endDate < draft.startDate) return null;
    try {
      return calculateRent(
        Number(tenant.agreed_rent_amount),
        draft.startDate,
        draft.endDate,
      );
    } catch {
      return null;
    }
  }, [draft.tenant_id, draft.startDate, draft.endDate, tenants]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                              */
  /* ------------------------------------------------------------------ */
  function openRecordModal() {
    loadTenants().catch(() => {});
    setDraft({ ...EMPTY_DRAFT, ...thisMonthRange(), paid_on: todayISO() });
    setRecordOpen(true);
  }
  function closeRecordModal() {
    setRecordOpen(false);
  }

  function handleTenantChange(tenantId: string) {
    const found = tenants.find((t) => t.id === tenantId);
    const { startDate, endDate } = getNextBillingPeriod(found, payments);
    setDraft((d) => ({
      ...d,
      tenant_id: tenantId,
      hostel_id: found?.hostel_id ?? d.hostel_id,
      amount: found?.agreed_rent_amount
        ? String(found.agreed_rent_amount)
        : d.amount,
      startDate,
      endDate,
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
    if (!draft.startDate || !draft.endDate) {
      toast.error("Please select a billing period.");
      return;
    }

    setSaving(true);
    try {
      const startDate = new Date(draft.startDate);
      const month = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: draft.tenant_id,
          hostel_id: draft.hostel_id,
          amount,
          month,
          method: draft.method || null,
          notes: draft.notes.trim() || null,
          status: draft.status,
          paid_on: draft.paid_on,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not record payment.");
        return;
      }
      setPayments((prev) => [json.payment as PaymentRow, ...prev]);
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
      paid_on: payment.paid_on ?? todayISO(),
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
    if (current && editDraft.paid_on !== current.paid_on)
      payload.paid_on = editDraft.paid_on;

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
        prev.map((p) => (p.id === editingId ? { ...p, ...updated } : p)),
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

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* â”€â”€ Header â”€â”€ */}
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
              Record and track rent payments.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={openRecordModal}>
          <Plus className="h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {/* â”€â”€ This-month dashboard â”€â”€ */}
      {!loading && (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {thisMonthStats.monthLabel}
            </p>
            <Badge variant="outline" className="text-[11px]">
              This Month
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Collected */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Collected
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatAmount(thisMonthStats.totalPaid)}
              </p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
                {thisMonthStats.totalCount} payment
                {thisMonthStats.totalCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
              <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
                Disputed
              </p>
              <p className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-300">
                {formatAmount(thisMonthStats.disputedAmt)}
              </p>
              <p className="text-[11px] text-violet-600/70 dark:text-violet-400/70">
                this month
              </p>
            </div>
            {/* Per-property */}
            {thisMonthStats.byHostel.size > 0 && (
              <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">
                  By Property
                </p>
                <div className="space-y-1.5">
                  {Array.from(thisMonthStats.byHostel.values()).map((h) => (
                    <div
                      key={h.name}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-[11px] text-foreground/80">
                        {h.name}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-foreground">
                        {formatAmount(h.paid)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* —— Filters —— */}
      {!loading && payments.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center w-full">
            {/* Search — narrower fixed width */}
            <div className="relative w-36 sm:w-44 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 pr-7 text-sm"
                placeholder="Search…"
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

            {/* Paid On Date Range Picker — takes remaining horizontal space */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[210px]">
              <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                Paid on
              </span>
              <DateRangePicker
                value={{
                  from: fromDate ? new Date(fromDate) : null,
                  to: toDate ? new Date(toDate) : null,
                }}
                onChange={(range: DateRange) => {
                  setFromDate(
                    range.from ? range.from.toISOString().slice(0, 10) : "",
                  );
                  setToDate(range.to ? range.to.toISOString().slice(0, 10) : "");
                }}
                placeholder="Any date range"
                className="flex-1"
              />
            </div>

            {/* Property */}
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

            {/* Status pills */}
            <div className="flex gap-1 flex-wrap">
              {(["all", "paid", "disputed"] as const).map((s) => (
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
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterHostelId("all");
                  setFilterStatus("all");
                  setFromDate("");
                  setToDate("");
                }}
                className="text-xs text-primary hover:underline ml-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Content â”€â”€ */}
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
          <ArrowUpDown className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No payments match your filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterHostelId("all");
              setFilterStatus("all");
              setFromDate("");
              setToDate("");
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
                payment.status === "disputed"
                  ? "border-violet-200/70 dark:border-violet-500/20"
                  : "border-border/70",
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
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
                          <CalendarCheck className="h-3 w-3" />
                          Paid: {formatDateShort(payment.paid_on)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatBillingPeriod(payment.month)}
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                printInvoice(payment);
                              }}
                              className="ml-0.5 text-muted-foreground transition-colors hover:text-primary"
                              title="Download / Print invoice"
                            >
                              <FileDown className="h-3 w-3" />
                            </button>
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

      {/* â”€â”€ Record Payment Modal â”€â”€ */}
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

            <div className="space-y-3">
              {/* Tenant */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Tenant <span className="text-rose-500">*</span>
                </Label>
                {tenantsLoading ? (
                  <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading tenants…
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
              {/* Billing period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Billing Start <span className="text-rose-500">*</span>
                  </Label>
                  <DatePicker
                    id="start-date"
                    value={draft.startDate}
                    onChange={(value) =>
                      setDraft((d) => ({
                        ...d,
                        startDate: value,
                        endDate: value ? getMonthEndDate(value) : d.endDate,
                      }))
                    }
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Billing End <span className="text-rose-500">*</span>
                  </Label>
                  <DatePicker
                    id="end-date"
                    value={draft.endDate}
                    onChange={(value) => setDraft((d) => ({ ...d, endDate: value }))}
                    placeholder="Select end date"
                  />
                </div>
              </div>
              {/* Billing calculation preview */}
              {billingPreview && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-primary">
                      Calculated Amount
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          amount: String(billingPreview.payableAmount),
                        }))
                      }
                      className="text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      Apply ₹{billingPreview.payableAmount.toLocaleString("en-IN")}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <div>
                      <p>Monthly rent</p>
                      <p className="font-medium text-foreground/80">
                        ₹{billingPreview.monthlyRent.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p>Occupied days</p>
                      <p className="font-medium text-foreground/80">
                        {billingPreview.occupiedDays} / {billingPreview.daysInMonth}
                      </p>
                    </div>
                    <div>
                      <p>Per day</p>
                      <p className="font-medium text-foreground/80">
                        ₹{billingPreview.perDayRent.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {billingPreview.isProrated && (
                    <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Pro-rated billing
                    </p>
                  )}
                </div>
              )}
              {/* Amount + Paid On */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </Label>
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Paid On <span className="text-rose-500">*</span>
                  </Label>
                  <DatePicker
                    value={draft.paid_on}
                    onChange={(value) => setDraft((d) => ({ ...d, paid_on: value }))}
                    placeholder="Select payment date"
                  />
                </div>
              </div>

              {/* Method + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Method</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as PaymentStatus,
                      }))
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Partial payment, UPI ref #123…"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  maxLength={1000}
                />
              </div>

              {draft.status === "paid" && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  A receipt number will be auto-generated.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
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
                disabled={saving}
                className="gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Edit Payment Modal â”€â”€ */}
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

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Paid On</Label>
                  <DatePicker
                    value={editDraft.paid_on}
                    onChange={(value) =>
                      setEditDraft((d) => ({ ...d, paid_on: value }))
                    }
                    placeholder="Select payment date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editDraft.status}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        status: e.target.value as PaymentStatus,
                      }))
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Method</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Input
                  placeholder="Optional notes…"
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
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
