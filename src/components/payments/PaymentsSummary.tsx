import { Banknote, CalendarDays, CheckCircle2, CircleAlert, Funnel, Receipt, WalletCards } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { PaymentsFilterPopover } from "./PaymentsFilterPopover";
import { formatDateInIndia } from "../../lib/date";

export type PaymentSummaryData = {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  disputedCount: number;
  averageAmount: number;
  byMethod: Record<string, { label: string; count: number; amount: number }>;
};

type PaymentsSummaryProps = {
  summary: PaymentSummaryData;
  formatAmount: (amount: number) => string;
  hostels: { id: string; name: string }[];
  hostelFilter: string;
  fromDate: string;
  toDate: string;
  hasActiveFilters: boolean;
  onHostelChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
};

const cards = [
  { key: "totalCount", label: "Payments made", icon: Receipt, iconClass: "text-primary", bgClass: "bg-primary/10" },
  { key: "totalAmount", label: "Total collected", icon: WalletCards, iconClass: "text-emerald-600", bgClass: "bg-emerald-500/10" },
  { key: "averageAmount", label: "Average payment", icon: Banknote, iconClass: "text-sky-600", bgClass: "bg-sky-500/10" },
  { key: "paidCount", label: "Paid records", icon: CheckCircle2, iconClass: "text-amber-600", bgClass: "bg-amber-500/10" },
] as const;

function formatSummaryDate(value: string) {
  return formatDateInIndia(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PaymentsSummary({
  summary,
  formatAmount,
  hostels,
  hostelFilter,
  fromDate,
  toDate,
  hasActiveFilters,
  onHostelChange,
  onFromDateChange,
  onToDateChange,
  onClear,
}: PaymentsSummaryProps) {
  return (
    <div id="payment-summary-panel" role="tabpanel" aria-labelledby="payment-summary-tab" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {fromDate && toDate
                ? `${formatSummaryDate(fromDate)} - ${formatSummaryDate(toDate)}`
                : "All dates"}
            </p>
          </div>
        </div>
        <PaymentsFilterPopover
          showStatus={false}
          hostelFilter={hostelFilter}
          statusFilter="all"
          fromDate={fromDate}
          toDate={toDate}
          hostels={hostels}
          hasActiveFilters={hasActiveFilters}
          onHostelChange={onHostelChange}
          onStatusChange={() => {}}
          onFromDateChange={onFromDateChange}
          onToDateChange={onToDateChange}
          onClear={onClear}
        >
          <Button type="button" variant="outline" size="icon" aria-label="Open summary filters" title="Open summary filters" className="h-10 w-10 shrink-0">
            <Funnel className="h-4 w-4" />
          </Button>
        </PaymentsFilterPopover>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = card.key === "totalCount" || card.key === "paidCount"
            ? summary[card.key]
            : formatAmount(summary[card.key]);
          return (
            <Card key={card.key} className="rounded-xl border-border/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bgClass}`}>
                    <Icon className={`h-4 w-4 ${card.iconClass}`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                    <p className="text-xl font-bold text-foreground">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
