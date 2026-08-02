import { Clock, User, UserCheck, UserX } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import type { TenantSummary as TenantSummaryCounts } from "./tenant-types";

type PropertyStatusCount = {
  name: string;
  total: number;
  pending: number;
  active: number;
  moved_out: number;
};

type TenantsSummaryProps = {
  summary: TenantSummaryCounts;
  hostelsCount: number;
  propertyStatusCounts: Record<string, PropertyStatusCount>;
};

const summaryCards = [
  { key: "total", label: "Total", icon: User, iconClass: "text-primary", bgClass: "bg-primary/10" },
  { key: "active", label: "Active", icon: UserCheck, iconClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
  { key: "pending", label: "Pending", icon: Clock, iconClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  { key: "moved_out", label: "Moved Out", icon: UserX, iconClass: "text-slate-500", bgClass: "bg-slate-500/10" },
] as const;

export function TenantsSummary({
  summary,
  hostelsCount,
  propertyStatusCounts,
}: TenantsSummaryProps) {
  return (
    <div
      id="summary-panel"
      role="tabpanel"
      aria-labelledby="summary-tab"
      className="space-y-3"
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Occupancy snapshot
          </p>
          <p className="text-sm text-muted-foreground">
            A quick view of tenant activity across your properties.
          </p>
        </div>
        <span className="hidden text-xs font-medium text-muted-foreground sm:block">
          {hostelsCount} {hostelsCount === 1 ? "property" : "properties"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const count = summary[card.key];
          const propertyKey = card.key === "total" ? "total" : card.key;

          return (
            <Card key={card.key} className="rounded-xl border-border/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bgClass}`}>
                    <Icon className={`h-4 w-4 ${card.iconClass}`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="text-xl font-bold text-foreground">{count}</p>
                  </div>
                </div>
                <div className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  {Object.values(propertyStatusCounts).map((item) => (
                    <div key={item.name}>
                      {item.name}: <span className="font-semibold text-foreground">{item[propertyKey]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
