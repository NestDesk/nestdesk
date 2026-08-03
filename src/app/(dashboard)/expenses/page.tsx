"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  useReactTable,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CalendarDays,
  CircleDot,
  Clock3,
  Funnel,
  IndianRupee,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
  ArrowUpDown,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { DatePicker } from "../../../components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";
import { formatDateInIndia, toIndianDateString } from "../../../lib/date";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PAYMENT_MODE_LABEL,
  EXPENSE_RECURRING_FREQUENCIES,
  EXPENSE_STATUS_LABEL,
  getExpenseCategoryLabel,
  type ExpenseCategory,
  type ExpensePaymentMode,
  type ExpenseRecurringFrequency,
  type ExpenseStatus,
} from "../../../lib/expenses";
import { cn } from "../../../lib/utils";

import ExpenseDailyTrend from "./ExpenseDailyTrend";
import { ExpensesFilterPopover } from "../../../components/expenses/ExpensesFilterPopover";
import { ExpensesTabs } from "../../../components/expenses/ExpensesTabs";

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
  category: "electricity_bills",
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
  return toIndianDateString(value);
}

function formatDate(dateStr: string) {
  return formatDateInIndia(`${dateStr}T00:00:00`, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toIndianDateString(start),
    end: toIndianDateString(end),
  };
}

function recurringFrequencyLabel(value: ExpenseRecurringFrequency | null) {
  if (!value) return "Recurring";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function summarizeExpenses(rows: ExpenseRow[], start: string, end: string) {
  const filtered = rows.filter((row) => {
    if (start && row.expense_date < start) return false;
    if (end && row.expense_date > end) return false;
    return true;
  });
  const periodSummary = filtered.reduce(
    (acc, row) => {
      const amount = Number(row.amount) || 0;
      acc.total += amount;
      if (row.status === "paid") acc.paid += amount;
      if (row.status === "pending") acc.pending += amount;
      if (row.status === "disputed") acc.disputed += amount;
      return acc;
    },
    { total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 },
  );
  periodSummary.this_month = periodSummary.total;

  const propertyMap = new Map<string, PropertyTotal>();
  for (const row of filtered) {
    const existing = propertyMap.get(row.hostel_id);
    if (existing) existing.total += Number(row.amount) || 0;
    else {
      propertyMap.set(row.hostel_id, {
        hostel_id: row.hostel_id,
        hostel_name: row.hostel_name,
        hostel_location: row.hostel_location,
        total: Number(row.amount) || 0,
      });
    }
  }

  const dailyMap = new Map<string, number>();
  if (start && end) {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dailyMap.set(toIndianDateString(date), 0);
    }
  }
  for (const row of filtered) {
    dailyMap.set(row.expense_date, (dailyMap.get(row.expense_date) ?? 0) + (Number(row.amount) || 0));
  }

  return {
    summary: periodSummary as Summary,
    propertyTotals: Array.from(propertyMap.values()).sort((a, b) => b.total - a.total),
    dailyTotals: Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total })),
  };
}

export default function OwnerExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 });
  const [thisMonthPropertyTotals, setThisMonthPropertyTotals] = useState<PropertyTotal[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const hasProperties = hostels.length > 0;
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => getCurrentMonthRange());
  const [summaryDateRange, setSummaryDateRange] = useState<{ start: string; end: string }>(() => getCurrentMonthRange());
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "expense_date", desc: true }]);
  const [activeTab, setActiveTab] = useState<"expense" | "summary">("expense");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState("all");
  const [filterCategory, setFilterCategory] = useState<"all" | ExpenseCategory>("all");
  const [summaryHostelId, setSummaryHostelId] = useState("all");
  const [summaryCategory, setSummaryCategory] = useState<"all" | ExpenseCategory>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryHighlightedIndex, setCategoryHighlightedIndex] = useState(0);
  const categoryComboRef = useRef<HTMLDivElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const get = () => {
      if (typeof document === "undefined") return false;
      const prefers = typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
      return document.documentElement.classList.contains("dark") || prefers;
    };
    setIsDarkTheme(get());
    const mql = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const onChange = () => setIsDarkTheme(get());
    if (mql && mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql && mql.addListener) mql.addListener(onChange);
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => setIsDarkTheme(get()))
      : null;
      if (observer) {
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }
    return () => {
      if (mql && mql.removeEventListener)
        mql.removeEventListener("change", onChange);
      else if (mql && mql.removeListener) mql.removeListener(onChange);
      if (observer) observer.disconnect();
    };
  }, []);

  const filteredCategoryOptions = useMemo(() => {
    return EXPENSE_CATEGORIES.filter((category) => {
      if (!categoryQuery.trim()) return true;
      const label = getExpenseCategoryLabel(category);
      return (
        label.toLowerCase().includes(categoryQuery.toLowerCase()) ||
        category.toLowerCase().includes(categoryQuery.toLowerCase())
      );
    });
  }, [categoryQuery]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryComboRef.current &&
        !categoryComboRef.current.contains(event.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryDropdownOpen]);

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
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, filterCategory, filterHostelId, dateRange]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: summaryDateRange.start,
        end_date: summaryDateRange.end,
      });
      if (summaryHostelId !== "all") params.set("hostel_id", summaryHostelId);
      if (summaryCategory !== "all") params.set("category", summaryCategory);

      const res = await fetch(`/api/expenses?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load expense summary.");
        return;
      }

      const serverExpenses = (json.expenses ?? []) as ExpenseRow[];
      setHostels((json.hostels ?? []) as HostelOption[]);
      const result = summarizeExpenses(
        serverExpenses,
        summaryDateRange.start,
        summaryDateRange.end,
      );
      setSummary(result.summary);
      setThisMonthPropertyTotals(result.propertyTotals);
      setDailyTotals(result.dailyTotals);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [summaryCategory, summaryDateRange, summaryHostelId]);

  useEffect(() => {
    const load = activeTab === "expense" ? loadExpenses : loadSummary;
    load().catch(() => {
      // handled
    });
  }, [activeTab, loadExpenses, loadSummary]);

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
                  {getExpenseCategoryLabel(expense.category)}
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
          if (!mode)
            return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CircleDot className="h-3 w-3" />
              {EXPENSE_PAYMENT_MODE_LABEL[mode]}
            </span>
          );
        },
        enableSorting: false,
      }),
      columnHelper.accessor("notes", {
        id: "notes",
        header: "Notes",
        cell: ({ getValue }) => {
          const notes = getValue();
          return (
            <span className="max-w-[220px] text-sm text-muted-foreground">
              {notes ? notes : "-"}
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
    setCategoryQuery("");
    setCategoryDropdownOpen(false);
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
    setCategoryQuery(getExpenseCategoryLabel(expense.category));
    setCategoryDropdownOpen(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setCategoryQuery("");
    setCategoryDropdownOpen(false);
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
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpensesTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "expense" ? (
        <div className="flex items-center gap-2">
          {!loading && hasProperties ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add expense"
              title="Add expense"
              onClick={openCreateModal}
              className="h-10 w-10 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : !loading && !hasProperties ? (
            <Link href="/hostels/new">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Add property"
                title="Add property"
                className="h-10 w-10 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 border-border/80 bg-muted/30 pl-9 pr-9 focus-visible:bg-background"
              placeholder="Search expenses"
              aria-label="Search expenses"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <ExpensesFilterPopover
            hostelFilter={filterHostelId}
            categoryFilter={filterCategory}
            fromDate={dateRange.start}
            toDate={dateRange.end}
            hostels={hostels}
            hasActiveFilters={
              filterHostelId !== "all" ||
              filterCategory !== "all" ||
              dateRange.start !== getCurrentMonthRange().start ||
              dateRange.end !== getCurrentMonthRange().end
            }
            onHostelChange={setFilterHostelId}
            onCategoryChange={setFilterCategory}
            onFromDateChange={(value) =>
              setDateRange((previous) => ({ ...previous, start: value }))
            }
            onToDateChange={(value) =>
              setDateRange((previous) => ({ ...previous, end: value }))
            }
            onClear={() => {
              setSearchQuery("");
              setFilterHostelId("all");
              setFilterCategory("all");
              setDateRange(getCurrentMonthRange());
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open expense filters"
              title="Open expense filters"
              className="h-10 w-10 border-border/80 bg-muted/30 hover:bg-background"
            >
              <Funnel className="h-4 w-4" />
            </Button>
          </ExpensesFilterPopover>
        </div>
      ) : null}

      {activeTab === "summary" ? (
        <div
          id="expense-summary-panel"
          role="tabpanel"
          aria-labelledby="expense-summary-tab"
          className="space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="whitespace-nowrap text-xs font-semibold text-foreground sm:text-sm">
                  {formatDate(summaryDateRange.start)} -{" "}
                  {formatDate(summaryDateRange.end)}
                </p>
              </div>
            </div>
            <ExpensesFilterPopover
              hostelFilter={summaryHostelId}
              categoryFilter={summaryCategory}
              fromDate={summaryDateRange.start}
              toDate={summaryDateRange.end}
              hostels={hostels}
              hasActiveFilters={
                summaryHostelId !== "all" ||
                summaryCategory !== "all" ||
                summaryDateRange.start !== getCurrentMonthRange().start ||
                summaryDateRange.end !== getCurrentMonthRange().end
              }
              onHostelChange={setSummaryHostelId}
              onCategoryChange={setSummaryCategory}
              onFromDateChange={(value) =>
                setSummaryDateRange((previous) => ({
                  ...previous,
                  start: value,
                }))
              }
              onToDateChange={(value) =>
                setSummaryDateRange((previous) => ({ ...previous, end: value }))
              }
              onClear={() => {
                setSummaryHostelId("all");
                setSummaryCategory("all");
                setSummaryDateRange(getCurrentMonthRange());
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open summary filters"
                title="Open summary filters"
                className="h-10 w-10 shrink-0"
              >
                <Funnel className="h-4 w-4" />
              </Button>
            </ExpensesFilterPopover>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden">
                {[
                  {
                    label: "Total spend",
                    value: formatAmount(summary.total),
                    icon: WalletCards,
                    tone: "text-primary bg-primary/10",
                  },
                  {
                    label: "Paid",
                    value: formatAmount(summary.paid),
                    icon: CheckCircle2,
                    tone: "text-emerald-600 bg-emerald-500/10",
                  },
                  {
                    label: "Pending",
                    value: formatAmount(summary.pending),
                    icon: Clock3,
                    tone: "text-amber-600 bg-amber-500/10",
                  },
                  {
                    label: "Disputed",
                    value: formatAmount(summary.disputed),
                    icon: AlertTriangle,
                    tone: "text-rose-600 bg-rose-500/10",
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {card.label}
                          </p>
                          <p className="mt-1 text-xl font-bold text-foreground">
                            {card.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4">
                <div className="hidden">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Status distribution
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Where the selected spend currently stands
                      </p>
                    </div>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        label: "Paid",
                        value: summary.paid,
                        tone: "bg-emerald-500",
                        icon: CheckCircle2,
                      },
                      {
                        label: "Pending",
                        value: summary.pending,
                        tone: "bg-amber-500",
                        icon: Clock3,
                      },
                      {
                        label: "Disputed",
                        value: summary.disputed,
                        tone: "bg-rose-500",
                        icon: AlertTriangle,
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const percentage =
                        summary.total > 0
                          ? Math.round((item.value / summary.total) * 100)
                          : 0;
                      return (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {item.label}
                            </span>
                            <span className="text-muted-foreground">
                              {formatAmount(item.value)} · {percentage}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${item.tone}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Spend by property
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Highest operating costs in this period
                      </p>
                    </div>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {thisMonthPropertyTotals.length === 0 ? (
                    <p className="py-5 text-sm text-muted-foreground">
                      No expenses recorded for these filters.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {thisMonthPropertyTotals
                        .slice(0, 6)
                        .map((item, index) => (
                          <div
                            key={item.hostel_id}
                            className="flex items-center gap-3"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.hostel_name}
                              </p>
                              <div className="mt-1 h-1.5 rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${summary.total > 0 ? Math.max(4, (item.total / summary.total) * 100) : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {formatAmount(item.total)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Daily expense trend
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Spend movement across the selected reporting period
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDate(summaryDateRange.start)} -{" "}
                    {formatDate(summaryDateRange.end)}
                  </span>
                </div>
                {dailyTotals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No trend data for these filters.
                  </p>
                ) : (
                  <ExpenseDailyTrend
                    dailyTotals={dailyTotals}
                    isDarkTheme={isDarkTheme}
                  />
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "expense" &&
        (loading ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>

            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>

            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : !hasProperties ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <IndianRupee className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No expenses found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your first expense to start tracking property operating
                costs.
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
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={
                            cell.column.id === "actions"
                              ? "px-3 py-2 text-right align-top"
                              : "px-3 py-2 align-top text-foreground/90"
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-3 py-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:px-0">
          <div className="mx-auto w-full max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
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
                      setDraft((prev) => ({
                        ...prev,
                        hostel_id: e.target.value,
                      }))
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

              <div className="space-y-1.5" ref={categoryComboRef}>
                <Label className="text-xs font-medium">Category</Label>
                <div className="relative">
                  <Input
                    placeholder={
                      categoryQuery
                        ? "Search or select category"
                        : getExpenseCategoryLabel(draft.category) ||
                          "Search or select category"
                    }
                    value={categoryQuery}
                    onFocus={() => {
                      setCategoryDropdownOpen(true);
                      setCategoryHighlightedIndex(0);
                      setCategoryQuery("");
                    }}
                    onChange={(e) => {
                      setCategoryQuery(e.target.value);
                      setCategoryDropdownOpen(true);
                      setCategoryHighlightedIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setCategoryDropdownOpen(true);
                        setCategoryHighlightedIndex((prev) =>
                          Math.min(
                            prev + 1,
                            filteredCategoryOptions.length - 1,
                          ),
                        );
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setCategoryDropdownOpen(true);
                        setCategoryHighlightedIndex((prev) =>
                          Math.max(prev - 1, 0),
                        );
                      }
                      if (e.key === "Enter") {
                        if (
                          categoryDropdownOpen &&
                          filteredCategoryOptions[categoryHighlightedIndex]
                        ) {
                          e.preventDefault();
                          const category =
                            filteredCategoryOptions[categoryHighlightedIndex];
                          setDraft((prev) => ({ ...prev, category }));
                          setCategoryQuery(getExpenseCategoryLabel(category));
                          setCategoryDropdownOpen(false);
                          setCategoryHighlightedIndex(0);
                        }
                      }
                      if (e.key === "Escape") {
                        setCategoryDropdownOpen(false);
                      }
                    }}
                    className="h-9 w-full"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setCategoryDropdownOpen((prev) => !prev);
                      setCategoryHighlightedIndex(0);
                      setCategoryQuery("");
                    }}
                  >
                    ▾
                  </button>
                  {categoryDropdownOpen ? (
                    <div className="absolute left-0 right-0 z-50 mt-1 min-w-full max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg">
                      {filteredCategoryOptions.length > 0 ? (
                        filteredCategoryOptions.map((category, index) => (
                          <button
                            key={category}
                            type="button"
                            className={
                              "flex w-full items-center px-3 py-2 text-left text-sm transition-colors " +
                              (index === categoryHighlightedIndex
                                ? "bg-muted text-foreground"
                                : "text-foreground hover:bg-muted")
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              setDraft((prev) => ({ ...prev, category }));
                              setCategoryQuery(
                                getExpenseCategoryLabel(category),
                              );
                              setCategoryDropdownOpen(false);
                              setCategoryHighlightedIndex(0);
                            }}
                          >
                            {getExpenseCategoryLabel(category)}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No categories match your search.
                        </div>
                      )}
                    </div>
                  ) : null}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Bill No. (optional)
                </Label>
                <Input
                  placeholder="Invoice / Bill reference"
                  value={draft.bill_number}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      bill_number: e.target.value,
                    }))
                  }
                />
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
                            {frequency.charAt(0).toUpperCase() +
                              frequency.slice(1)}
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
                          setDraft((prev) => ({
                            ...prev,
                            next_due_date: value,
                          }))
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
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {editingId ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
