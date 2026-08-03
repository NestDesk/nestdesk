import * as React from "react";
import { CalendarCheck, ListFilter, RotateCcw, X } from "lucide-react";
import { DatePicker } from "../ui/DatePicker";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  EXPENSE_CATEGORIES,
  getExpenseCategoryLabel,
  type ExpenseCategory,
} from "../../lib/expenses";

type ExpensesFilterPopoverProps = {
  hostelFilter: string;
  categoryFilter: "all" | ExpenseCategory;
  fromDate: string;
  toDate: string;
  hostels: { id: string; name: string }[];
  hasActiveFilters: boolean;
  onHostelChange: (value: string) => void;
  onCategoryChange: (value: "all" | ExpenseCategory) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
  showDateRange?: boolean;
  children: React.ReactNode;
};

export function ExpensesFilterPopover({
  hostelFilter,
  categoryFilter,
  fromDate,
  toDate,
  hostels,
  hasActiveFilters,
  onHostelChange,
  onCategoryChange,
  onFromDateChange,
  onToDateChange,
  onClear,
  showDateRange = true,
  children,
}: ExpensesFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[calc(100dvh-1rem)] w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ListFilter className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          </div>
          <div className="flex items-center gap-0.5">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClear}
                aria-label="Reset expense filters"
                title="Reset expense filters"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
            <PopoverClose
              aria-label="Close expense filters"
              title="Close expense filters"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </PopoverClose>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Property
            <select
              aria-label="Filter expenses by property"
              className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
              value={hostelFilter}
              onChange={(event) => onHostelChange(event.target.value)}
            >
              <option value="all">All properties</option>
              {hostels.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Category
            <select
              aria-label="Filter expenses by category"
              className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
              value={categoryFilter}
              onChange={(event) =>
                onCategoryChange(event.target.value as "all" | ExpenseCategory)
              }
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {getExpenseCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          {showDateRange ? <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" />
              Expense date
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                <span>Start date</span>
                <DatePicker
                  value={fromDate}
                  onChange={onFromDateChange}
                  placeholder="Start date"
                  buttonClassName="w-full gap-1 px-2 text-xs"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                <span>End date</span>
                <DatePicker
                  value={toDate}
                  onChange={onToDateChange}
                  placeholder="End date"
                  buttonClassName="w-full gap-1 px-2 text-xs"
                />
              </label>
            </div>
          </div> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}