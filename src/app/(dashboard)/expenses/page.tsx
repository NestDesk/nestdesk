"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  useReactTable,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  Building2,
  CalendarDays,
  CircleDot,
  IndianRupee,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  WalletCards,
  X,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PAYMENT_MODE_LABEL,
  EXPENSE_RECURRING_FREQUENCIES,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABEL,
  type ExpenseCategory,
  type ExpensePaymentMode,
  type ExpenseRecurringFrequency,
  type ExpenseStatus,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";

import ExpenseDailyTrend from "./ExpenseDailyTrend";

type ExpenseRow = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
  payment_mode: ExpensePaymentMode | null;
  vendor_name: string | null;
  bill_number: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_frequency: ExpenseRecurringFrequency | null;
  next_due_date: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
};

type HostelOption = {
  id: string;
  name: string;
  location: string | null;
  onboarded_at: string;
};

type Summary = {
  total: number;
  paid: number;
  pending: number;
  disputed: number;
  this_month: number;
};

type PropertyTotal = {
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  total: number;
};

type RecurringTemplate = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  title: string;
  amount: number;
  status: ExpenseStatus;
  recurring_frequency: ExpenseRecurringFrequency | null;
  next_due_date: string | null;
};

type DailyTotal = {
  date: string;
  total: number;
};

type ExpenseDraft = {
  hostel_id: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  expense_date: string;
  status: ExpenseStatus;
  payment_mode: ExpensePaymentMode | "";
  vendor_name: string;
  bill_number: string;
  notes: string;
  is_recurring: boolean;
  recurring_frequency: ExpenseRecurringFrequency | "";
  next_due_date: string;
};

const STATUS_CHIP: Record<ExpenseStatus, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  disputed:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
};

const EMPTY_DRAFT: ExpenseDraft = {
  hostel_id: "",
  title: "",
  category: "maintenance_repair",
  amount: "",
  expense_date: toInputDate(),
  status: "paid",
  payment_mode: "cash",
  vendor_name: "",
  bill_number: "",
  notes: "",
  is_recurring: false,
  recurring_frequency: "",
  next_due_date: "",
};

const columnHelper = createColumnHelper<ExpenseRow>();

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toInputDate(value: Date = new Date()) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function recurringFrequencyLabel(value: ExpenseRecurringFrequency | null) {
  if (!value) return "Recurring";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export default function OwnerExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    paid: 0,
    pending: 0,
    disputed: 0,
    this_month: 0,
  });
  const [thisMonthPropertyTotals, setThisMonthPropertyTotals] = useState<
    PropertyTotal[]
  >([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  // Remove monthOptions, use date range picker instead
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    // Default to current month (local dates to avoid timezone shifts)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (v: Date) => {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    return { start: fmt(start), end: fmt(end) };
  });

  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "expense_date", desc: true },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | ExpenseStatus>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | ExpenseCategory>(
    "all",
  );
  // Remove filterMonth

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // detect dark mode to choose contrasting chart color
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  useEffect(() => {
    const get = () => {
      if (typeof document === "undefined") return false;
      const prefers =
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : false;
      return document.documentElement.classList.contains("dark") || prefers;
    };
    setIsDarkTheme(get());
    const mql =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const onChange = () => setIsDarkTheme(get());
    if (mql && mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql && mql.addListener) mql.addListener(onChange);
    const observer =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => setIsDarkTheme(get()))
        : null;
    if (observer)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    return () => {
      if (mql && mql.removeEventListener)
        mql.removeEventListener("change", onChange);
      else if (mql && mql.removeListener) mql.removeListener(onChange);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterHostelId !== "all") params.set("hostel_id", filterHostelId);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (debouncedSearchQuery) params.set("q", debouncedSearchQuery);
      // Add date range (for the table / list view)
      if (dateRange.start) params.set("start_date", dateRange.start);
      if (dateRange.end) params.set("end_date", dateRange.end);

      const res = await fetch(`/api/expenses?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Could not load expenses.");
        return;
      }

      const serverExpenses = (json.expenses ?? []) as ExpenseRow[];

      setExpenses(serverExpenses);
      setHostels((json.hostels ?? []) as HostelOption[]);

      // Derive period-specific aggregates from the server-provided expenses
      // based on the selected date range so the cards and chart reflect
      // user-selected filters.
      const start = dateRange.start;
      const end = dateRange.end;
      const filtered = serverExpenses.filter((r) => {
        if (start && r.expense_date < start) return false;
        if (end && r.expense_date > end) return false;
        return true;
      });

      // Summary for selected range
      const periodSummary = filtered.reduce(
        (acc, row) => {
          const amt = Number(row.amount) || 0;
          acc.total += amt;
          if (row.status === "paid") acc.paid += amt;
          if (row.status === "pending") acc.pending += amt;
          if (row.status === "disputed") acc.disputed += amt;
          return acc;
        },
        { total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 },
      );

      // Use `this_month` field to represent the selected-period total so
      // existing UI (which displays summary.this_month) shows the correct
      // value for the chosen date range.
      periodSummary.this_month = periodSummary.total;
      setSummary(periodSummary as Summary);

      // Property totals for selected range
      const propMap = new Map<string, PropertyTotal>();
      for (const r of filtered) {
        const existing = propMap.get(r.hostel_id);
        if (existing) existing.total += Number(r.amount) || 0;
        else
          propMap.set(r.hostel_id, {
            hostel_id: r.hostel_id,
            hostel_name: r.hostel_name,
            hostel_location: r.hostel_location,
            total: Number(r.amount) || 0,
          });
      }
      const rangePropertyTotals = Array.from(propMap.values()).sort(
        (a, b) => b.total - a.total,
      );
      setThisMonthPropertyTotals(rangePropertyTotals);

      // Daily totals for selected range (include zero days)
      const dailyMap = new Map<string, number>();
      if (start && end) {
        const s = new Date(`${start}T00:00:00`);
        const e = new Date(`${end}T00:00:00`);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dailyMap.set(`${y}-${m}-${dd}`, 0);
        }
      }
      for (const r of filtered) {
        const key = r.expense_date;
        const prev = dailyMap.get(key) ?? 0;
        dailyMap.set(key, prev + (Number(r.amount) || 0));
      }
      const rangeDailyTotals = Array.from(dailyMap.entries()).map(
        ([date, total]) => ({ date, total }),
      );
      setDailyTotals(rangeDailyTotals as DailyTotal[]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearchQuery,
    filterCategory,
    filterHostelId,
    filterStatus,
    dateRange,
  ]);

  useEffect(() => {
    loadExpenses().catch(() => {
      // handled
    });
  }, [loadExpenses]);

  const chartSeries = useMemo(
    () => [
      {
        name: "Expenses",
        data: dailyTotals.map((row) => Number(row.total)),
      },
    ],
    [dailyTotals],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        id: "title",
        header: "Expense",
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <div className="min-w-[240px] space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {expense.title}
                </p>
                <Badge variant="outline" className="h-5 text-[11px]">
                  {EXPENSE_CATEGORY_LABEL[expense.category]}
                </Badge>
                {expense.is_recurring ? (
                  <Badge variant="outline" className="h-5 text-[11px]">
                    <Repeat className="mr-1 h-3 w-3" />
                    {recurringFrequencyLabel(expense.recurring_frequency)}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {expense.hostel_name}
                </span>
                {expense.vendor_name ? (
                  <span className="inline-flex items-center gap-1">
                    Vendor: {expense.vendor_name}
                  </span>
                ) : null}
                {expense.bill_number ? (
                  <span className="inline-flex items-center gap-1">
                    Bill: {expense.bill_number}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("amount", {
        id: "amount",
        header: "Amount",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-sm font-semibold text-foreground">
            {formatAmount(Number(getValue()))}
          </span>
        ),
      }),
      columnHelper.accessor("expense_date", {
        id: "expense_date",
        header: "Date",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {formatDate(getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Badge className={cn("h-5 text-[11px]", STATUS_CHIP[status])}>
              {EXPENSE_STATUS_LABEL[status]}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("payment_mode", {
        id: "payment_mode",
        header: "Payment",
        cell: ({ row }) => {
          const mode = row.original.payment_mode;
          if (!mode) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CircleDot className="h-3 w-3" />
              {EXPENSE_PAYMENT_MODE_LABEL[mode]}
            </span>
          );
        },
        enableSorting: false,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const expense = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={() => openEditModal(expense)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit expense
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onSelect={() => openDeleteDialog(expense.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete expense
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function openCreateModal() {
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      hostel_id: hostels.length === 1 ? hostels[0].id : "",
      expense_date: toInputDate(),
    });
    setModalOpen(true);
  }

  function openEditModal(expense: ExpenseRow) {
    setEditingId(expense.id);
    setDraft({
      hostel_id: expense.hostel_id,
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      status: expense.status,
      payment_mode: expense.payment_mode ?? "",
      vendor_name: expense.vendor_name ?? "",
      bill_number: expense.bill_number ?? "",
      notes: expense.notes ?? "",
      is_recurring: expense.is_recurring,
      recurring_frequency: expense.recurring_frequency ?? "",
      next_due_date: expense.next_due_date ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function openDeleteDialog(expenseId: string) {
    setDeleteExpenseId(expenseId);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteExpenseId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteExpenseId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete expense.");
        return;
      }
      toast.success("Expense deleted.");
      setDeleteDialogOpen(false);
      setDeleteExpenseId(null);
      await loadExpenses();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    const amount = Number(draft.amount);

    if (!draft.hostel_id) {
      toast.error("Please select a property.");
      return;
    }
    if (draft.title.trim().length < 2) {
      toast.error("Title must be at least 2 characters.");
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!draft.expense_date) {
      toast.error("Please select expense date.");
      return;
    }
    if (draft.is_recurring && !draft.recurring_frequency) {
      toast.error("Select recurring frequency.");
      return;
    }
    if (draft.is_recurring && !draft.next_due_date) {
      toast.error("Select due date for recurring expense.");
      return;
    }

    const payload = {
      hostel_id: draft.hostel_id,
      title: draft.title.trim(),
      category: draft.category,
      amount,
      expense_date: draft.expense_date,
      status: draft.status,
      payment_mode: draft.payment_mode || null,
      vendor_name: draft.vendor_name.trim() || null,
      bill_number: draft.bill_number.trim() || null,
      notes: draft.notes.trim() || null,
      is_recurring: draft.is_recurring,
      recurring_frequency: draft.is_recurring
        ? draft.recurring_frequency || null
        : null,
      next_due_date: draft.is_recurring ? draft.next_due_date || null : null,
    };

    setSaving(true);
    try {
      if (!editingId) {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Could not record expense.");
          return;
        }
        toast.success("Expense recorded.");
      } else {
        const res = await fetch(`/api/expenses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Could not update expense.");
          return;
        }
        toast.success("Expense updated.");
      }

      closeModal();
      await loadExpenses();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteExpenseId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Expense
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this expense entry and it cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <WalletCards className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Expenses
            </h2>
            <p className="text-sm text-muted-foreground">
              Professional operating expense view with analytics, recurring controls,
              and monthly trend tracking.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Filters - moved above cards, single row */}
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 pr-8 text-sm"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground w-full md:w-44"
          value={filterHostelId}
          onChange={(e) => setFilterHostelId(e.target.value)}
        >
          <option value="all">All Properties</option>
          {hostels.map((hostel) => (
            <option key={hostel.id} value={hostel.id}>
              {hostel.name}
            </option>
          ))}
        </select>
        {/* Date Range Picker */}
        <div className="flex gap-2 items-center">
          <DatePicker
            value={dateRange.start}
            onChange={(val) => setDateRange((prev) => ({ ...prev, start: val }))}
            placeholder="Start date"
          />
          <span className="text-muted-foreground">to</span>
          <DatePicker
            value={dateRange.end}
            onChange={(val) => setDateRange((prev) => ({ ...prev, end: val }))}
            placeholder="End date"
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground w-full md:w-40"
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value as "all" | ExpenseCategory)
          }
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {EXPENSE_CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground w-full md:w-36"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | ExpenseStatus)}
        >
          <option value="all">All Status</option>
          {EXPENSE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EXPENSE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {/* Cards - Current Month, Recurring, and Daily Trend */}
      {!loading && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Current Period Expenses
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-200">
              {formatAmount(summary.this_month)}
            </p>
            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
              {dateRange.start && dateRange.end
                ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                : "-"}
            </p>
            <div className="mt-3 space-y-1.5">
              {thisMonthPropertyTotals.length === 0 ? (
                <p className="text-xs text-blue-700/70 dark:text-blue-300/80">
                  No current-period expenses recorded.
                </p>
              ) : (
                thisMonthPropertyTotals.slice(0, 5).map((item) => (
                  <div
                    key={item.hostel_id}
                    className="flex items-center justify-between rounded-md border border-blue-200/70 bg-white/60 px-2.5 py-1.5 dark:border-blue-500/30 dark:bg-blue-900/20"
                  >
                    <span className="truncate text-xs text-blue-800 dark:text-blue-200">
                      {item.hostel_name}
                    </span>
                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                      {formatAmount(item.total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recurring Expenses card removed per request */}

          {/* Daily Trend - as compact line chart */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col justify-between lg:col-span-2 min-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-primary">Daily Trend</h3>
              <span className="text-xs font-semibold text-muted-foreground">
                {dateRange.start && dateRange.end
                  ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                  : "-"}
              </span>
            </div>
            {dailyTotals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No trend data.</p>
            ) : (
              <ExpenseDailyTrend
                dailyTotals={dailyTotals}
                isDarkTheme={isDarkTheme}
              />
            )}
          </div>
        </div>
      )}

      {/* Duplicate Daily Trend card removed (compact chart kept above) */}

      {/* Filters moved above, this block removed */}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <IndianRupee className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No expenses found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first expense to start tracking property operating costs.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
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
                            ? "px-3 py-2 text-right align-top"
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-xl rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {editingId ? "Edit Expense" : "Add Expense"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Property</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.hostel_id}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, hostel_id: e.target.value }))
                    }
                  >
                    <option value="">Select property...</option>
                    {hostels.map((hostel) => (
                      <option key={hostel.id} value={hostel.id}>
                        {hostel.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date</Label>
                  <DatePicker
                    value={draft.expense_date}
                    onChange={(value) =>
                      setDraft((prev) => ({ ...prev, expense_date: value }))
                    }
                    placeholder="Select expense date"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Expense Title</Label>
                <Input
                  placeholder="e.g. Electricity Bill - May"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  maxLength={160}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Category</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        category: e.target.value as ExpenseCategory,
                      }))
                    }
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {EXPENSE_CATEGORY_LABEL[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount (INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        status: e.target.value as ExpenseStatus,
                      }))
                    }
                  >
                    {EXPENSE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {EXPENSE_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Mode</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.payment_mode}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        payment_mode: e.target.value as ExpensePaymentMode | "",
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    {EXPENSE_PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {EXPENSE_PAYMENT_MODE_LABEL[mode]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Vendor (optional)</Label>
                  <Input
                    placeholder="Vendor / Service Provider"
                    value={draft.vendor_name}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, vendor_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bill No. (optional)</Label>
                  <Input
                    placeholder="Invoice / Bill reference"
                    value={draft.bill_number}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, bill_number: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_recurring}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const checked = e.target.checked;
                        return {
                          ...prev,
                          is_recurring: checked,
                          recurring_frequency: checked
                            ? prev.recurring_frequency || "monthly"
                            : "",
                          // When enabling recurring, default due date to the expense date
                          // if no next_due_date is already set.
                          next_due_date: checked
                            ? prev.next_due_date || prev.expense_date || ""
                            : "",
                        };
                      })
                    }
                  />
                  <span className="text-sm font-medium text-foreground">
                    Recurring Expense
                  </span>
                </label>

                {draft.is_recurring ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Frequency</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={draft.recurring_frequency}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            recurring_frequency: e.target.value as
                              | ExpenseRecurringFrequency
                              | "",
                          }))
                        }
                      >
                        {EXPENSE_RECURRING_FREQUENCIES.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        Due Date <span className="text-rose-600">*</span>
                      </Label>
                      <DatePicker
                        value={draft.next_due_date}
                        onChange={(value) =>
                          setDraft((prev) => ({ ...prev, next_due_date: value }))
                        }
                        placeholder="Select due date"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Input
                  placeholder="Any additional details"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {editingId ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
