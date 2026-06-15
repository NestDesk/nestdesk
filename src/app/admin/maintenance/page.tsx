import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Wrench, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  open: {
    label: "Open",
    class: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  in_progress: {
    label: "In Progress",
    class: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  resolved: {
    label: "Resolved",
    class: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  completed: {
    label: "Completed",
    class: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  closed: {
    label: "Closed",
    class: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  rejected: {
    label: "Rejected",
    class: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
};

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const admin = createAdminClient();

  const [
    { count: openCount },
    { count: inProgressCount },
    { count: resolvedCount },
    { count: totalCount },
    { data: requests },
  ] = await Promise.all([
    admin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open")
      .is("deleted_at", null),
    admin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress")
      .is("deleted_at", null),
    admin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["resolved", "completed"])
      .is("deleted_at", null),
    admin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("maintenance_requests")
      .select(
        "id, title, description, status, created_at, updated_at, hostel_id, room_id, hostels!inner(name, city)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const summaryCards = [
    {
      label: "Open",
      value: openCount ?? 0,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "In Progress",
      value: inProgressCount ?? 0,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Resolved / Completed",
      value: resolvedCount ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total All Time",
      value: totalCount ?? 0,
      icon: Wrench,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10">
          <Wrench className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Platform Operations
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Maintenance Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All maintenance requests across every property.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/60 shadow-sm"
          >
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Requests table */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            All Requests (most recent first)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Property
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Raised
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(requests ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No maintenance requests found.
                    </td>
                  </tr>
                ) : (
                  (requests ?? []).map((req) => {
                    const cfg = STATUS_CONFIG[req.status] ?? {
                      label: req.status,
                      class: "bg-muted text-muted-foreground",
                    };
                    const hostel = req.hostels as unknown as {
                      name: string;
                      city: string;
                    };

                    return (
                      <tr
                        key={req.id}
                        className="group hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{req.title}</p>
                          {req.description && (
                            <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                              {req.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p className="text-sm">{hostel?.name ?? "—"}</p>
                          <p className="text-xs">{hostel?.city ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.class}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDateInIndia(req.created_at, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDateInIndia(req.updated_at, {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
