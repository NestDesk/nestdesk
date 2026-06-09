import { Skeleton } from "../../components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-border/70 bg-card/70 p-8 shadow-sm">
        <div className="space-y-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-8 w-72 rounded-2xl" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
        </div>

        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  );
}
