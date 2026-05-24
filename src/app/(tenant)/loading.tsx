import { Skeleton } from "@/components/ui/skeleton";

export default function TenantPortalLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
