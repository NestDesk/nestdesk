import { Download, Loader2, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "../../lib/utils";
import { METHOD_LABEL } from "./tenant-constants";
import type { PaymentHistoryItem } from "./tenant-types";
import {
  formatTenantAmount,
  formatTenantDate,
  formatTenantMonth,
} from "./tenant-utils";
import type { PaymentMethod } from "../payments/RecordPaymentModal";

type PaymentHistorySummary = {
  totalPaid: number;
  disputedAmount: number;
  total: number;
};

type TenantPaymentHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName?: string;
  items: PaymentHistoryItem[];
  summary: PaymentHistorySummary;
  loading: boolean;
  onPrintInvoice: (payment: PaymentHistoryItem) => void;
};

export function TenantPaymentHistoryDialog({
  open,
  onOpenChange,
  tenantName,
  items,
  summary,
  loading,
  onPrintInvoice,
}: TenantPaymentHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Payment History
          </DialogTitle>
          <DialogDescription>
            {tenantName} — all recorded payments
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No payments recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Total Paid
                </p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatTenantAmount(summary.totalPaid)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Disputed
                </p>
                <p className="mt-0.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {formatTenantAmount(summary.disputedAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Records
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {summary.total}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Paid On</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Billing Period</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Method</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs text-foreground">{formatTenantDate(payment.paid_on)}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {payment.billing_start || payment.billing_end ? (
                          <span className="whitespace-pre-line">
                            {payment.billing_start ? formatTenantDate(payment.billing_start) : "-"}
                            {payment.billing_start && payment.billing_end ? " - " : ""}
                            {payment.billing_end ? formatTenantDate(payment.billing_end) : ""}
                          </span>
                        ) : formatTenantMonth(payment.month)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-foreground">
                        {formatTenantAmount(Number(payment.amount))}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {payment.method ? (METHOD_LABEL[payment.method as PaymentMethod] ?? payment.method) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          payment.status === "paid"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
                        )}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{payment.receipt_number ?? "-"}</span>
                          {payment.receipt_number ? (
                            <button
                              type="button"
                              onClick={() => onPrintInvoice(payment)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
                              title="Download invoice"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
