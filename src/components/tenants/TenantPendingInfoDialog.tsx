import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { TenantPaymentCoverage } from "./tenant-types";
import { formatTenantAmount, formatTenantDate } from "./tenant-utils";

type TenantPendingInfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName?: string;
  detail: TenantPaymentCoverage | null;
};

export function TenantPendingInfoDialog({
  open,
  onOpenChange,
  tenantName,
  detail,
}: TenantPendingInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rent Status Details</DialogTitle>
          <DialogDescription>
            {tenantName} billing status from rent start date.
          </DialogDescription>
        </DialogHeader>

        {detail?.status === "paid" ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300">
            Fully paid till today.
            {detail.coveredTill
              ? ` Covered till ${formatTenantDate(detail.coveredTill)}.`
              : ""}
          </div>
        ) : detail ? (
          <div className="space-y-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3 text-sm text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300">
            <div>
              <p>Pending Amount: {formatTenantAmount(detail.pendingAmount)}</p>
              <p>
                Pending Period: {formatTenantDate(detail.pendingFrom)} - {formatTenantDate(detail.pendingTo)}
              </p>
              {detail.coveredTill ? (
                <p>Last Paid Till: {formatTenantDate(detail.coveredTill)}</p>
              ) : (
                <p>No paid period found yet.</p>
              )}
            </div>

            {detail.pendingBreakdown.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-md border border-orange-200/70 bg-background/70 dark:border-orange-500/30">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orange-200/70 text-left dark:border-orange-500/30">
                      <th className="px-2 py-1.5">Month</th>
                      <th className="px-2 py-1.5">Dates</th>
                      <th className="px-2 py-1.5">Days</th>
                      <th className="px-2 py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.pendingBreakdown.map((row) => (
                      <tr
                        key={`${row.start}-${row.end}`}
                        className="border-b border-orange-100/80 last:border-b-0 dark:border-orange-500/20"
                      >
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span>{row.monthLabel}</span>
                            {row.isPartial ? (
                              <span className="rounded-full border border-orange-300 px-1.5 py-0 text-[10px] leading-4 dark:border-orange-500/40">
                                Partial
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          {formatTenantDate(row.start)} - {formatTenantDate(row.end)}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.occupiedDays}/{row.daysInMonth}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">
                          {formatTenantAmount(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
