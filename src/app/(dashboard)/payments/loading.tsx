import { Skeleton } from "../../../components/ui/skeleton";
import { PaymentsLedgerSkeleton } from "../../../components/payments/PaymentsLedgerSkeleton";

export default function PaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="flex gap-5 border-b border-border/70 pb-3 sm:gap-7">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>

      <PaymentsLedgerSkeleton />
    </div>
  );
}
