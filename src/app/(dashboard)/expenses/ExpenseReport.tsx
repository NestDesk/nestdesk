"use client";

import { Building2 } from "lucide-react";
import ExpenseDailyTrend from "./ExpenseDailyTrend";
import { formatDateInIndia } from "../../../lib/date";

type PropertyTotal = {
  hostel_id: string;
  hostel_name: string;
  total: number;
};

type DailyTotal = {
  date: string;
  total: number;
};

type ExpenseReportProps = {
  propertyTotals: PropertyTotal[];
  dailyTotals: DailyTotal[];
  dateRange: { start: string; end: string };
  isDarkTheme: boolean;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return formatDateInIndia(`${dateStr}T00:00:00`, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ExpenseReport({
  propertyTotals,
  dailyTotals,
  dateRange,
  isDarkTheme,
}: ExpenseReportProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Total expense by property
            </h3>
            <p className="text-xs text-muted-foreground">
              Property operating costs for the selected period
            </p>
          </div>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        {propertyTotals.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            No expenses recorded for these filters.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {propertyTotals.map((item) => (
              <div
                key={item.hostel_id}
                className="rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {item.hostel_name}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatAmount(item.total)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Expense trend
            </h3>
            <p className="text-xs text-muted-foreground">
              Daily spend across the selected reporting period
            </p>
          </div>
          <span className="text-right text-xs font-medium text-muted-foreground">
            {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
          </span>
        </div>
        {dailyTotals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No trend data for these filters.
          </p>
        ) : (
          <ExpenseDailyTrend
            dailyTotals={dailyTotals}
            isDarkTheme={isDarkTheme}
            className="h-72 w-full"
          />
        )}
      </div>
    </div>
  );
}
