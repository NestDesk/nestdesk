import { Skeleton } from "../components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-10 w-72 rounded-2xl" />
            <Skeleton className="h-4 w-full max-w-2xl rounded-full" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-64 rounded-full" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_0.9fr]">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
