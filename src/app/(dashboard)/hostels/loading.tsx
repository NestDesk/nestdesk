import { Skeleton } from "@/components/ui/skeleton";

export default function HostelsLoading() {
  return (
    <div className="space-y-6">
      {/* Header banner */}
      <Skeleton className="h-40 rounded-3xl" />

      {/* Property cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
