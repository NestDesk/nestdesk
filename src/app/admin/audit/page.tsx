import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { ShieldCheck, Activity } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  admin_add_credits: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  insert: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  update: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  delete: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function actionColor(action: string) {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action];
  if (action.startsWith("admin_"))
    return "bg-violet-500/10 text-violet-700 dark:text-violet-400";
  return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400";
}

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const admin = createAdminClient();

  const [{ count: totalCount }, { data: logs }] = await Promise.all([
    admin.from("audit_logs").select("*", { count: "exact", head: true }),
    admin
      .from("audit_logs")
      .select(
        "id, action, table_name, record_id, old_value, new_value, ip_address, user_agent, created_at, owner_id, owners(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const actionCounts: Record<string, number> = {};
  for (const log of logs ?? []) {
    actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;
  }

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10">
          <ShieldCheck className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Security & Compliance
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Audit Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount ?? 0} total audit events recorded on the platform.
          </p>
        </div>
      </div>

      {/* Top actions summary */}
      {topActions.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Activity Summary (recent 150)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-5">
            {topActions.map(([action, count]) => (
              <div
                key={action}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${actionColor(action)}`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span className="capitalize">{formatAction(action)}</span>
                <span className="rounded-full bg-current/10 px-1.5 py-0.5 font-bold">
                  {count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Logs table */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Table
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Record ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    IP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(logs ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No audit logs yet.
                    </td>
                  </tr>
                ) : (
                  (logs ?? []).map((log) => {
                    const owner = log.owners as unknown as {
                      full_name: string;
                      email: string | null;
                    } | null;

                    return (
                      <tr
                        key={log.id}
                        className="group hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${actionColor(log.action)}`}
                          >
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {log.table_name}
                        </td>
                        <td className="px-4 py-3">
                          {owner ? (
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                {owner.full_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {owner.email ?? ""}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                          {log.record_id ? `${log.record_id.slice(0, 8)}…` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {log.ip_address ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDateInIndia(log.created_at, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
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
