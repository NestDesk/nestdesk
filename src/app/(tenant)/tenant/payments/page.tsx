"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Download, IndianRupee, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatDateInIndia } from "@/lib/date";
import { printInvoice } from "@/lib/invoice";
import { cn } from "@/lib/utils";

type PaymentRow = {
  hostel_name: string;
  tenant_name: string | null;
  room_number: string | null;
  id: string;
  amount: number;
  month: string;
  status: "paid" | "disputed";
  method: string | null;
  receipt_number: string | null;
  notes: string | null;
  paid_on: string;
  created_at: string;
  hostel_billing_address?: string | null;
  hostel_address?: string | null;
  hostel_gst_number?: string | null;
  hostel_pan_number?: string | null;
};

type Summary = {
  totalPaid: number;
  disputedAmount: number;
  total: number;
};

const STATUS_CHIP: Record<string, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  disputed:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
};

const METHOD_LABEL: Record<string, string> = {
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
  return formatDateInIndia(dateStr, {
    month: "long",
    year: "numeric",
  });
}

function formatDate(dateStr: string) {
  return formatDateInIndia(dateStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TenantPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPaid: 0,
    disputedAmount: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tenant/payments", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Could not load payments.");
          return;
        }
        setPayments((json.payments ?? []) as PaymentRow[]);
        setSummary(json.summary ?? { totalPaid: 0, disputedAmount: 0, total: 0 });
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load().catch(() => {
      // handled
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Payment History
          </h1>
          <p className="text-sm text-muted-foreground">
            Your rent payments and receipts.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Total Paid
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatAmount(summary.totalPaid)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs text-amber-700 dark:text-amber-400">Disputed</p>
              <p className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-300">
                {formatAmount(summary.disputedAmount)}
              </p>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <IndianRupee className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No payments recorded yet
              </p>
              <p className="text-xs text-muted-foreground">
                Your rent payment history will appear here once recorded by your
                owner.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "rounded-2xl border transition-shadow hover:shadow-sm",
                    p.status === "disputed"
                      ? "border-violet-200/70 dark:border-violet-500/20"
                      : "border-border/70",
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <IndianRupee className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {formatMonth(p.month)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-5 text-[11px]",
                                STATUS_CHIP[p.status] ?? "",
                              )}
                            >
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-base font-bold text-foreground">
                            {formatAmount(Number(p.amount))}
                            {p.method && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                via {METHOD_LABEL[p.method] ?? p.method}
                              </span>
                            )}
                          </p>
                          {p.paid_on && (
                            <p className="text-xs text-muted-foreground">
                              Paid on {formatDate(p.paid_on)}
                            </p>
                          )}
                          {p.notes && (
                            <p className="text-xs text-muted-foreground">
                              Note: {p.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {p.receipt_number && (
                        <div className="shrink-0 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Receipt className="h-3 w-3" />
                              {p.receipt_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => printInvoice(p)}
                              className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground transition hover:border-primary hover:text-foreground"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
