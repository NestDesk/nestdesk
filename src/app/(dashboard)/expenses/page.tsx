"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CircleDot,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/DatePicker";
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

type CategoryTotal = {
  category: ExpenseCategory;
  total: number;
};

type MonthlyTotal = {
  month: string;
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

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function toInputDate(value: Date = new Date()) {
  return value.toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

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
  const [propertyTotals, setPropertyTotals] = useState<PropertyTotal[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | ExpenseStatus>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | ExpenseCategory>(
    "all",
  );
  const [filterMonth, setFilterMonth] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set(expenses.map((e) => e.expense_date.slice(0, 7)));
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((m) => ({ value: m, label: monthLabel(m) }));
  }, [expenses]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterHostelId !== "all") params.set("hostel_id", filterHostelId);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterMonth !== "all") params.set("month", filterMonth);
      if (appliedSearchQuery.trim()) params.set("q", appliedSearchQuery.trim());

      const res = await fetch(`/api/expenses?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load expenses.");
        return;
      }

      setExpenses((json.expenses ?? []) as ExpenseRow[]);
      setHostels((json.hostels ?? []) as HostelOption[]);
      setSummary(
        (json.summary as Summary) ?? {
          total: 0,
          paid: 0,
          pending: 0,
          disputed: 0,
          this_month: 0,
        },
      );
      setPropertyTotals((json.property_totals ?? []) as PropertyTotal[]);
      setCategoryTotals((json.category_totals ?? []) as CategoryTotal[]);
      setMonthlyTotals((json.monthly_totals ?? []) as MonthlyTotal[]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    filterHostelId,
    filterStatus,
    filterCategory,
    filterMonth,
    appliedSearchQuery,
  ]);

  useEffect(() => {
    loadExpenses().catch(() => {
      // handled
    });
  }, [loadExpenses]);

  const recurringCount = useMemo(
    () => expenses.filter((e) => e.is_recurring).length,
    [expenses],
  );

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

    setSaving(true);
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

  async function handleDelete(expenseId: string) {
    setDeletingId(expenseId);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete expense.");
        return;
      }
      setConfirmDeleteId(null);
      toast.success("Expense deleted.");
      await loadExpenses();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
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
              Track complete property operating costs with property-wise and total
              analytics.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatAmount(summary.total)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
            <p className="text-xs text-blue-700 dark:text-blue-400">This Month</p>
            <p className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">
              {formatAmount(summary.this_month)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">Pending</p>
            <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">
              {formatAmount(summary.pending)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
            <p className="text-xs text-violet-700 dark:text-violet-400">Recurring</p>
            <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
              {recurringCount}
            </p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 lg:col-span-1">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Property-wise Total
              </h3>
              <div className="mt-3 space-y-2">
                {propertyTotals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data available.</p>
                ) : (
                  propertyTotals.map((row) => (
                    <div
                      key={row.hostel_id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {row.hostel_name}
                        </p>
                        {row.hostel_location ? (
                          <p className="text-[11px] text-muted-foreground">
                            {row.hostel_location}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        {formatAmount(row.total)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 lg:col-span-1">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Category Breakdown
              </h3>
              <div className="mt-3 space-y-2">
                {categoryTotals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data available.</p>
                ) : (
                  categoryTotals.slice(0, 8).map((row) => (
                    <div
                      key={row.category}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                    >
                      <span className="text-xs text-foreground">
                        {EXPENSE_CATEGORY_LABEL[row.category]}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {formatAmount(row.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 lg:col-span-1">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Monthly Trend
              </h3>
              <div className="mt-3 space-y-2">
                {monthlyTotals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data available.</p>
                ) : (
                  monthlyTotals.slice(-6).map((row) => {
                    const max = Math.max(...monthlyTotals.map((m) => m.total), 1);
                    const width = Math.max(8, Math.round((row.total / max) * 100));
                    return (
                      <div key={row.month} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{monthLabel(row.month)}</span>
                          <span>{formatAmount(row.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Search title, vendor, bill number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setAppliedSearchQuery(searchQuery.trim());
              }
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                setAppliedSearchQuery("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

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

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          <option value="all">All Months</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
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

        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setAppliedSearchQuery(searchQuery.trim())}
        >
          Apply
        </Button>
      </div>

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
              Add your first running expense to start property cost tracking.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {expenses.map((expense) => (
            <Card key={expense.id} className="rounded-2xl border border-border/70">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {expense.title}
                      </span>
                      <Badge
                        className={cn(
                          "h-5 text-[11px]",
                          STATUS_CHIP[expense.status],
                        )}
                      >
                        {EXPENSE_STATUS_LABEL[expense.status]}
                      </Badge>
                      <Badge variant="outline" className="h-5 text-[11px]">
                        {EXPENSE_CATEGORY_LABEL[expense.category]}
                      </Badge>
                      {expense.is_recurring ? (
                        <Badge variant="outline" className="h-5 text-[11px]">
                          <Repeat className="mr-1 h-3 w-3" />
                          {expense.recurring_frequency ?? "Recurring"}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        {formatAmount(Number(expense.amount))}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(expense.expense_date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {expense.hostel_name}
                      </span>
                      {expense.payment_mode ? (
                        <span className="inline-flex items-center gap-1">
                          <CircleDot className="h-3 w-3" />
                          {EXPENSE_PAYMENT_MODE_LABEL[expense.payment_mode]}
                        </span>
                      ) : null}
                      {expense.bill_number ? (
                        <span className="inline-flex items-center gap-1">
                          <ReceiptText className="h-3 w-3" />
                          {expense.bill_number}
                        </span>
                      ) : null}
                    </div>

                    {(expense.vendor_name || expense.notes) && (
                      <p className="text-xs text-muted-foreground">
                        {expense.vendor_name ? `Vendor: ${expense.vendor_name}` : ""}
                        {expense.vendor_name && expense.notes ? " • " : ""}
                        {expense.notes ? expense.notes : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditModal(expense)}
                      title="Edit expense"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {confirmDeleteId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Sure?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={deletingId === expense.id}
                          onClick={() => handleDelete(expense.id)}
                        >
                          {deletingId === expense.id ? (
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
                        className="h-8 w-8 p-0 text-muted-foreground hover:border-rose-300 hover:text-rose-600"
                        onClick={() => setConfirmDeleteId(expense.id)}
                        title="Delete expense"
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
                      setDraft((p) => ({ ...p, hostel_id: e.target.value }))
                    }
                  >
                    <option value="">Select property...</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date</Label>
                  <DatePicker
                    value={draft.expense_date}
                    onChange={(value) =>
                      setDraft((p) => ({ ...p, expense_date: value }))
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
                    setDraft((p) => ({ ...p, title: e.target.value }))
                  }
                  maxLength={160}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs font-medium">Category</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        category: e.target.value as ExpenseCategory,
                      }))
                    }
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {EXPENSE_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs font-medium">Amount (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, amount: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs font-medium">Status</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
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
                      setDraft((p) => ({
                        ...p,
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
                      setDraft((p) => ({ ...p, vendor_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bill No. (optional)</Label>
                  <Input
                    placeholder="Invoice / Bill reference"
                    value={draft.bill_number}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, bill_number: e.target.value }))
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
                      setDraft((p) => ({
                        ...p,
                        is_recurring: e.target.checked,
                        recurring_frequency: e.target.checked
                          ? p.recurring_frequency || "monthly"
                          : "",
                        next_due_date: e.target.checked ? p.next_due_date : "",
                      }))
                    }
                  />
                  <span className="text-sm font-medium text-foreground">
                    Recurring Expense
                  </span>
                </label>

                {draft.is_recurring && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Frequency</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={draft.recurring_frequency}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
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
                        Next Due Date (optional)
                      </Label>
                      <DatePicker
                        value={draft.next_due_date ?? ""}
                        onChange={(value) =>
                          setDraft((p) => ({ ...p, next_due_date: value }))
                        }
                        placeholder="Select next due date"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Input
                  placeholder="Any additional details"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, notes: e.target.value }))
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
