import { Skeleton } from "../ui/skeleton";

export function PaymentsLedgerSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading ledger">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border/70 p-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
