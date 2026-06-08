import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Megaphone, EyeOff, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const admin = createAdminClient();

  const [
    { count: totalCount },
    { count: publishedCount },
    { count: draftCount },
    { data: notices },
  ] = await Promise.all([
    admin
      .from("notices")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("notices")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true)
      .is("deleted_at", null),
    admin
      .from("notices")
      .select("*", { count: "exact", head: true })
      .eq("is_published", false)
      .is("deleted_at", null),
    admin
      .from("notices")
      .select(
        "id, title, body, is_published, published_at, created_at, updated_at, hostel_id, owner_id, hostels!inner(name, city), owners!inner(full_name, email)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10">
          <Megaphone className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Communications
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Notices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All notices posted by property owners across the platform.
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2">
          <Megaphone className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-foreground">
            {totalCount ?? 0} Total
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2">
          <Eye className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {publishedCount ?? 0} Published
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-zinc-500/10 px-4 py-2">
          <EyeOff className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {draftCount ?? 0} Draft
          </span>
        </div>
      </div>

      {/* Notices grid */}
      {(notices ?? []).length === 0 ? (
        <Card className="rounded-2xl border border-border/60">
          <CardContent className="py-14 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No notices found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(notices ?? []).map((notice) => {
            const hostel = notice.hostels as unknown as {
              name: string;
              city: string;
            };
            const owner = notice.owners as unknown as {
              full_name: string;
              email: string | null;
            };

            return (
              <Card
                key={notice.id}
                className="rounded-2xl border border-border/60 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-sm font-semibold leading-snug">
                      {notice.title}
                    </CardTitle>
                    {notice.is_published ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Published
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Draft
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
                    {notice.body}
                  </p>
                  <div className="space-y-1 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {hostel?.name ?? "—"}
                    </p>
                    <p>{hostel?.city ?? ""}</p>
                    <p className="text-[11px]">by {owner?.full_name ?? "—"}</p>
                    <p className="text-[11px]">
                      {notice.is_published && notice.published_at
                        ? `Published ${formatDateInIndia(notice.published_at, { day: "numeric", month: "short", year: "numeric" })}`
                        : `Created ${formatDateInIndia(notice.created_at, { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
