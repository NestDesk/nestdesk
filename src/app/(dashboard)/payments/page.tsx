"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarCheck,
  CreditCard,
  Download,
  FileDown,
  IndianRupee,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import {
  RecordPaymentModal,
  type PaymentMethod,
  type PaymentStatus,
  type RecordPaymentTenantOption,
} from "../../../components/payments/RecordPaymentModal";
import { DatePicker } from "../../../components/ui/DatePicker";
import { Input } from "../../../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Label } from "../../../components/ui/label";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { formatDateInIndia, toIndianDateString } from "../../../lib/date";
import { printInvoice } from "../../../lib/invoice";

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
  billing_start: string;
  billing_end: string;
  created_at: string;
  updated_at: string;
};

type TenantOption = RecordPaymentTenantOption;

type HostelOption = {
  id: string;
  name: string;
  location: string | null;
};

type EditDraft = {
  status: PaymentStatus;
  method: PaymentMethod | "";
  notes: string;
  amount: string;
  paid_on: string;
  startDate: string;
  endDate: string;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const columnHelper = createColumnHelper<PaymentRow>();

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatBillingPeriod(dateStr: string) {
  const date = new Date(dateStr);
  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    formatDateInIndia(d, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  return `${fmt(startDate)} - ${fmt(endDate)}`;
}

function formatDateShort(dateStr: string) {
  return formatDateInIndia(dateStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPropertyAddress(payment: PaymentRow) {
  const parts = [
    payment.hostel_address,
    payment.hostel_city,
    payment.hostel_state,
    payment.hostel_pincode,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  const uniqueParts: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const normalized = part.replace(/\s+/g, " ").toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParts.push(part);
    }
  }

  return uniqueParts.join(", ");
}

function todayISO() {
  return toIndianDateString();
}

function toLocalISO(date: Date) {
  return toIndianDateString(date);
}

function getMonthEndDate(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return toLocalISO(new Date(year, month - 1, lastDay));
}

function thisMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toLocalISO(first),
    endDate: toLocalISO(last),
  };
}

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
  const [fromDate, setFromDate] = useState(() => thisMonthRange().startDate);
  const [toDate, setToDate] = useState(() => thisMonthRange().endDate);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Record modal
  const [recordOpen, setRecordOpen] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    status: "paid",
    method: "",
    notes: "",
    amount: "",
    paid_on: todayISO(),
    startDate: todayISO(),
    endDate: todayISO(),
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentRow | null>(null);
  function openDeleteDialog(paymentId: string) {
    setDeletingId(paymentId);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/payments/${deletingId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete payment.");
        return;
      }
      setPayments((prev) => prev.filter((p) => p.id !== deletingId));
      toast.success("Payment deleted.");
      setDeleteDialogOpen(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

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

      const uniqueHostels = Array.from(
        new Map(
          rows.map((row) => [
            row.hostel_id,
            {
              id: row.hostel_id,
              name: row.hostel_name,
              location: row.hostel_location,
            },
          ]),
        ).values(),
      );

      setHostels(uniqueHostels);
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

  const columns = [
    columnHelper.accessor("hostel_name", {
      header: "Property",
      cell: (info) => <span className="text-foreground">{info.getValue()}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor("room_number", {
      header: "Room Number",
      cell: (info) => info.getValue() ?? "—",
      enableSorting: true,
    }),
    columnHelper.accessor("tenant_name", {
      header: "Tenant Name",
      cell: (info) => <span className="text-foreground">{info.getValue()}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor("month", {
      header: "Billing Period",
      cell: (info) => {
        const payment = info.row.original;
        if (payment.billing_start && payment.billing_end) {
          return `${formatDateShort(payment.billing_start)} - ${formatDateShort(
            payment.billing_end,
          )}`;
        }
        return formatBillingPeriod(info.getValue());
      },
      enableSorting: true,
    }),
    columnHelper.accessor("amount", {
      header: "Paid Amount",
      cell: (info) => (
        <span className="text-foreground">
          {formatAmount(Number(info.getValue()))}
        </span>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("paid_on", {
      header: "Paid On",
      cell: (info) => formatDateShort(info.getValue()),
      enableSorting: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const payment = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full p-0"
                  aria-label="Open payment actions"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => openDetailModal(payment)}>
                  <Receipt className="h-4 w-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!payment.receipt_number}
                  onSelect={() => payment.receipt_number && printInvoice(payment)}
                >
                  <FileDown className="h-4 w-4" />
                  {payment.receipt_number ? "Download invoice" : "No invoice"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openEditModal(payment)}>
                  <Pencil className="h-4 w-4" />
                  Edit payment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => openDeleteDialog(payment.id)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete payment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function downloadExcel() {
    const rows = table.getRowModel().rows.map((row) => row.original);
    const header = [
      "Property Name",
      "Property Address",
      "GST Number",
      "PAN Number",
      "Room Number",
      "Tenant Name",
      "Billing Period",
      "Paid Amount",
      "Paid On",
      "Payment Method",
      "Status",
      "Receipt Number",
      "Paid At",
      "Created At",
      "Updated At",
      "Notes",
    ];
    const csv = [header.join(",")];

    for (const payment of rows) {
      const values = [
        payment.hostel_name,
        formatPropertyAddress(payment),
        payment.hostel_gst_number ?? "",
        payment.hostel_pan_number ?? "",
        payment.room_number ?? "",
        payment.tenant_name,
        formatBillingPeriod(payment.month),
        formatAmount(Number(payment.amount)),
        formatDateShort(payment.paid_on),
        payment.method ? METHOD_LABEL[payment.method] : "",
        payment.status,
        payment.receipt_number ?? "",
        payment.paid_at ? formatDateShort(payment.paid_at) : "",
        payment.created_at ? formatDateShort(payment.created_at) : "",
        payment.updated_at ? formatDateShort(payment.updated_at) : "",
        payment.notes ?? "",
      ];
      csv.push(
        values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      );
    }

    const blob = new Blob([csv.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  // ...existing code...
  // Place the delete confirmation dialog at the root of the component render
  // ...existing code...

  function downloadPdf() {
    const rows = table.getRowModel().rows.map((row) => row.original);
    const htmlRows = rows
      .map(
        (payment) => `
          <tr>
            <td>${payment.hostel_name}</td>
            <td>${formatPropertyAddress(payment)}</td>
            <td>${payment.hostel_gst_number ?? ""}</td>
            <td>${payment.hostel_pan_number ?? ""}</td>
            <td>${payment.room_number ?? ""}</td>
            <td>${payment.tenant_name}</td>
            <td>${formatBillingPeriod(payment.month)}</td>
            <td>${formatAmount(Number(payment.amount))}</td>
            <td>${formatDateShort(payment.paid_on)}</td>
            <td>${payment.method ? METHOD_LABEL[payment.method] : ""}</td>
            <td>${payment.status}</td>
            <td>${payment.receipt_number ?? ""}</td>
            <td>${payment.paid_at ? formatDateShort(payment.paid_at) : ""}</td>
            <td>${payment.created_at ? formatDateShort(payment.created_at) : ""}</td>
            <td>${payment.updated_at ? formatDateShort(payment.updated_at) : ""}</td>
            <td>${payment.notes ?? ""}</td>
          </tr>
        `,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payments Export</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 10px 8px; border: 1px solid #d1d5db; text-align: left; vertical-align: top; }
    th { background: #f9fafb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { font-size: 10px; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    .wrap { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <h1>Exported Payments</h1>
  <table>
    <thead>
      <tr>
        <th>Property Name</th>
        <th>Address</th>
        <th>GST Number</th>
        <th>PAN Number</th>
        <th>Room</th>
        <th>Tenant</th>
        <th>Billing Period</th>
        <th>Paid Amount</th>
        <th>Paid On</th>
        <th>Method</th>
        <th>Status</th>
        <th>Receipt</th>
        <th>Paid At</th>
        <th>Created At</th>
        <th>Updated At</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${htmlRows}
    </tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups and try again.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                              */
  /* ------------------------------------------------------------------ */
  function openRecordModal() {
    loadTenants().catch(() => {});
    setRecordOpen(true);
  }
  function closeRecordModal() {
    setRecordOpen(false);
  }

  function openEditModal(payment: PaymentRow) {
    const startDate = payment.billing_start ?? `${payment.month}-01`;
    const endDate = payment.billing_end ?? getMonthEndDate(payment.month);
    setEditingId(payment.id);
    setEditDraft({
      status: payment.status,
      method: payment.method ?? "",
      notes: payment.notes ?? "",
      amount: String(payment.amount),
      paid_on: payment.paid_on ?? todayISO(),
      startDate,
      endDate,
    });
    setEditOpen(true);
  }

  function openDetailModal(payment: PaymentRow) {
    setDetailPayment(payment);
    setDetailOpen(true);
  }

  async function handleEditSave() {
    if (!editingId) return;
    const amount = parseFloat(editDraft.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    if (!editDraft.startDate || !editDraft.endDate) {
      toast.error("Please select billing start and end dates.");
      return;
    }
    if (editDraft.endDate < editDraft.startDate) {
      toast.error("Billing end cannot be before billing start.");
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
    if (current && editDraft.startDate !== current.billing_start)
      payload.billing_start = editDraft.startDate;
    if (current && editDraft.endDate !== current.billing_end)
      payload.billing_end = editDraft.endDate;
    if (current) {
      const start = new Date(editDraft.startDate);
      const monthValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      if (monthValue !== current.month.slice(0, 7)) {
        payload.month = monthValue;
      }
    }

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

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Delete Payment Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Payment
            </DialogTitle>
            <DialogDescription>
              This will{" "}
              <strong className="text-foreground">permanently delete</strong> this
              payment record. <br />
              <span className="text-destructive font-semibold">
                This action cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

      {!loading && payments.length > 0 && (
        <div className="space-y-3">
          <div className="grid w-full gap-3 lg:grid-cols-[2.7fr_2.3fr_auto] lg:items-center">
            <div className="relative min-w-0 w-full">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-full pl-8 pr-7 text-sm"
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

            <div className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Paid on
                </span>
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <DatePicker
                  value={fromDate}
                  onChange={(value) => setFromDate(value)}
                  placeholder="Start date"
                  className="min-w-0"
                />
                <DatePicker
                  value={toDate}
                  onChange={(value) => setToDate(value)}
                  placeholder="End date"
                  className="min-w-0"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterHostelId("all");
                  setFilterStatus("all");
                  const { startDate, endDate } = thisMonthRange();
                  setFromDate(startDate);
                  setToDate(endDate);
                }}
                title="Reset filters"
                aria-label="Reset filters"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={downloadExcel}>
                    Download Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={downloadPdf}>
                    Download PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-[13px]">
              <thead className="bg-muted text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-3 py-2 align-top">
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-muted-foreground"
                            onClick={
                              header.column.getCanSort()
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {header.column.getCanSort() ? (
                              <ArrowUpDown
                                className={
                                  header.column.getIsSorted()
                                    ? "h-3.5 w-3.5 text-foreground"
                                    : "h-3.5 w-3.5 text-muted-foreground"
                                }
                              />
                            ) : null}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/50">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === "actions"
                            ? "px-3 py-2 align-top text-right"
                            : "px-3 py-2 align-top text-foreground/90"
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailOpen && detailPayment && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Payment details
              </h3>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tenant
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {detailPayment.tenant_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Room
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {detailPayment.room_number ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Billing period
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatBillingPeriod(detailPayment.month)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Billing Start
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDateShort(detailPayment.billing_start)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Billing End
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDateShort(detailPayment.billing_end)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Paid on
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDateShort(detailPayment.paid_on)}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatAmount(Number(detailPayment.amount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-1 text-sm text-foreground capitalize">
                    {detailPayment.status}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Method
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {detailPayment.method
                      ? METHOD_LABEL[detailPayment.method]
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Receipt
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {detailPayment.receipt_number ?? "—"}
                  </p>
                </div>
              </div>
              {detailPayment.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {detailPayment.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </Button>
              {detailPayment.receipt_number && (
                <Button
                  size="sm"
                  onClick={() => {
                    printInvoice(detailPayment);
                    setDetailOpen(false);
                  }}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Download invoice
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <RecordPaymentModal
        open={recordOpen}
        onClose={closeRecordModal}
        tenants={tenants}
        tenantsLoading={tenantsLoading}
        payments={payments}
        onRecorded={(payment) => {
          setPayments((prev) => [payment as PaymentRow, ...prev]);
        }}
      />

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Billing Start</Label>
                  <DatePicker
                    value={editDraft.startDate}
                    onChange={(value) =>
                      setEditDraft((d) => ({
                        ...d,
                        startDate: value,
                        endDate: value ? getMonthEndDate(value) : d.endDate,
                      }))
                    }
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Billing End</Label>
                  <DatePicker
                    value={editDraft.endDate}
                    onChange={(value) =>
                      setEditDraft((d) => ({ ...d, endDate: value }))
                    }
                    placeholder="Select end date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
