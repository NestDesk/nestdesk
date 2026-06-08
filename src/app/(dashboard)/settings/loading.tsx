import { Skeleton } from "../../../components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* Section heading */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Property cards */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
