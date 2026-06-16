"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { DatePicker } from "../ui/DatePicker";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { calculateRent, type RentCalculation } from "../../lib/billing";

export type PaymentStatus = "paid" | "disputed";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "other";

export type RecordPaymentTenantOption = {
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

type RecordPaymentDraft = {
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

type ExistingPayment = {
  tenant_id: string;
  month: string;
  billing_end?: string | null;
};

const EMPTY_DRAFT: RecordPaymentDraft = {
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

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
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

function thisMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toLocalISO(first),
    endDate: toLocalISO(last),
  };
}

function getNextBillingPeriod(
  tenant?: RecordPaymentTenantOption,
  paymentsList: ExistingPayment[] = [],
) {
  if (!tenant) {
    return thisMonthRange();
  }

  const tenantPayments = paymentsList.filter(
    (payment) => payment.tenant_id === tenant.id,
  );

  const lastPaymentByBillingEnd = tenantPayments
    .filter((payment) => /^\d{4}-\d{2}-\d{2}$/.test(payment.billing_end ?? ""))
    .reduce<ExistingPayment | null>((current, payment) => {
      if (!current) return payment;
      return (payment.billing_end ?? "") > (current.billing_end ?? "")
        ? payment
        : current;
    }, null);

  if (lastPaymentByBillingEnd?.billing_end) {
    const lastEnd = new Date(lastPaymentByBillingEnd.billing_end);
    if (!Number.isNaN(lastEnd.getTime())) {
      const nextStart = new Date(lastEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      const startDate = toLocalISO(nextStart);
      return {
        startDate,
        endDate: getMonthEndDate(startDate),
      };
    }
  }

  const tenantMonthPayments = tenantPayments.filter((payment) =>
    /^\d{4}-\d{2}-\d{2}$/.test(payment.month),
  );

  if (tenantMonthPayments.length > 0) {
    const latest = tenantMonthPayments.reduce(
      (current, payment) => (payment.month > current.month ? payment : current),
      tenantMonthPayments[0],
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

type RecordPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  tenants: RecordPaymentTenantOption[];
  tenantsLoading?: boolean;
  payments?: ExistingPayment[];
  initialTenantId?: string | null;
  tenantLocked?: boolean;
  onRecorded: (payment: unknown) => void | Promise<void>;
};

export function RecordPaymentModal({
  open,
  onClose,
  tenants,
  tenantsLoading = false,
  payments = [],
  initialTenantId = null,
  tenantLocked = false,
  onRecorded,
}: RecordPaymentModalProps) {
  const [draft, setDraft] = useState<RecordPaymentDraft>({
    ...EMPTY_DRAFT,
    ...thisMonthRange(),
  });
  const [saving, setSaving] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  useEffect(() => {
    if (!open) return;

    setAmountTouched(false);

    if (!initialTenantId) {
      setDraft({ ...EMPTY_DRAFT, ...thisMonthRange(), paid_on: todayISO() });
      return;
    }

    const tenant = tenants.find((item) => item.id === initialTenantId);
    const { startDate, endDate } = getNextBillingPeriod(tenant, payments);
    let initialAmount =
      tenant?.agreed_rent_amount !== null && tenant?.agreed_rent_amount !== undefined
        ? String(tenant.agreed_rent_amount)
        : "";

    // When opening for a tenant with a prorated period, prefill payable amount.
    if (tenant?.agreed_rent_amount && startDate && endDate) {
      try {
        const calc = calculateRent(
          Number(tenant.agreed_rent_amount),
          startDate,
          endDate,
        );
        if (calc.isProrated) {
          initialAmount = String(calc.payableAmount);
        }
      } catch {
        // Keep fallback amount when calculation fails.
      }
    }

    setDraft({
      ...EMPTY_DRAFT,
      tenant_id: initialTenantId,
      hostel_id: tenant?.hostel_id ?? "",
      amount: initialAmount,
      startDate,
      endDate,
      paid_on: todayISO(),
    });
  }, [initialTenantId, open, payments, tenants]);

  const billingPreview = useMemo<RentCalculation | null>(() => {
    const tenant = tenants.find((item) => item.id === draft.tenant_id);
    if (!tenant?.agreed_rent_amount || !draft.startDate || !draft.endDate) {
      return null;
    }
    if (draft.endDate < draft.startDate) {
      return null;
    }
    try {
      return calculateRent(
        Number(tenant.agreed_rent_amount),
        draft.startDate,
        draft.endDate,
      );
    } catch {
      return null;
    }
  }, [draft.endDate, draft.startDate, draft.tenant_id, tenants]);

  // Auto-fill amount with the pro-rated payable whenever the billing context
  // changes (new tenant or new dates) and the owner hasn't manually overridden it.
  const prevBillingKeyRef = useRef("");
  useEffect(() => {
    if (!billingPreview) return;

    const key = `${draft.tenant_id}|${draft.startDate}|${draft.endDate}`;
    const contextChanged = prevBillingKeyRef.current !== key;

    if (contextChanged) {
      prevBillingKeyRef.current = key;
      setAmountTouched(false);
    }

    const shouldAutoFill = contextChanged || !amountTouched;

    if (!shouldAutoFill) return;

    const nextAmount = String(billingPreview.payableAmount);
    setDraft((current) =>
      current.amount === nextAmount ? current : { ...current, amount: nextAmount },
    );
  }, [
    amountTouched,
    billingPreview,
    draft.endDate,
    draft.startDate,
    draft.tenant_id,
  ]);

  function handleTenantChange(tenantId: string) {
    const tenant = tenants.find((item) => item.id === tenantId);
    const { startDate, endDate } = getNextBillingPeriod(tenant, payments);
    setAmountTouched(false);
    setDraft((current) => ({
      ...current,
      tenant_id: tenantId,
      hostel_id: tenant?.hostel_id ?? current.hostel_id,
      amount: tenant?.agreed_rent_amount
        ? String(tenant.agreed_rent_amount)
        : current.amount,
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
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: draft.tenant_id,
          hostel_id: draft.hostel_id,
          amount,
          month,
          billing_start: draft.startDate,
          billing_end: draft.endDate,
          method: draft.method || null,
          notes: draft.notes.trim() || null,
          status: draft.status,
          paid_on: draft.paid_on,
        }),
      });
      const json = (await response.json()) as { error?: string; payment?: unknown };
      if (!response.ok) {
        toast.error(json.error ?? "Could not record payment.");
        return;
      }

      await onRecorded(json.payment);
      toast.success("Payment recorded.");
      onClose();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  const visibleTenants =
    tenantLocked && draft.tenant_id
      ? tenants.filter((tenant) => tenant.id === draft.tenant_id)
      : tenants;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Record Payment</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Tenant <span className="text-rose-500">*</span>
            </Label>
            {tenantsLoading ? (
              <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading tenants...
              </div>
            ) : visibleTenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active tenants found.
              </p>
            ) : (
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
                value={draft.tenant_id}
                onChange={(event) => handleTenantChange(event.target.value)}
                disabled={tenantLocked}
              >
                {!tenantLocked && <option value="">Select a tenant...</option>}
                {visibleTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                    {tenant.room_number ? ` - Room ${tenant.room_number}` : ""}
                    {` (${tenant.hostel_name})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Billing Start <span className="text-rose-500">*</span>
              </Label>
              <DatePicker
                id="start-date"
                value={draft.startDate}
                onChange={(value) => {
                  setAmountTouched(false);
                  setDraft((current) => ({
                    ...current,
                    startDate: value,
                    endDate: value ? getMonthEndDate(value) : current.endDate,
                  }));
                }}
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
                onChange={(value) => {
                  setAmountTouched(false);
                  setDraft((current) => ({ ...current, endDate: value }));
                }}
                placeholder="Select end date"
              />
            </div>
          </div>

          {billingPreview && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-primary">Calculated Amount</p>
                <button
                  type="button"
                  onClick={() => {
                    setAmountTouched(false);
                    setDraft((current) => ({
                      ...current,
                      amount: String(billingPreview.payableAmount),
                    }));
                  }}
                  className="text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  Apply ₹{billingPreview.payableAmount.toLocaleString("en-IN")}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                onChange={(event) => {
                  setAmountTouched(true);
                  setDraft((current) => ({
                    ...current,
                    amount: event.target.value,
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Paid On <span className="text-rose-500">*</span>
              </Label>
              <DatePicker
                value={draft.paid_on}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, paid_on: value }))
                }
                placeholder="Select payment date"
                max={todayISO()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Method</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={draft.method}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    method: event.target.value as PaymentMethod | "",
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
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as PaymentStatus,
                  }))
                }
              >
                <option value="paid">Paid</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Input
              placeholder="e.g. Partial payment, UPI ref #123..."
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
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
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
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
  );
}
