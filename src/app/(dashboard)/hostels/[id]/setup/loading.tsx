import { Skeleton } from "../../../../../components/ui/skeleton";

export default function HostelSetupLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* Info bar */}
      <Skeleton className="h-14 rounded-2xl" />

      {/* Setup manager */}
      <Skeleton className="h-80 rounded-2xl" />

      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
