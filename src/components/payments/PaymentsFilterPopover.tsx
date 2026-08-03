import * as React from "react";
import { ArrowUpDown, CalendarCheck, ListFilter, RotateCcw, X } from "lucide-react";
import { DatePicker } from "../ui/DatePicker";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../ui/popover";

type PaymentsFilterPopoverProps = {
  hostelFilter: string;
  statusFilter: "all" | "paid" | "disputed";
  showStatus?: boolean;
  fromDate: string;
  toDate: string;
  hostels: { id: string; name: string }[];
  hasActiveFilters: boolean;
  onHostelChange: (value: string) => void;
  onStatusChange: (value: "all" | "paid" | "disputed") => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
  children: React.ReactNode;
};

export function PaymentsFilterPopover({
  hostelFilter,
  statusFilter,
  showStatus = true,
  fromDate,
  toDate,
  hostels,
  hasActiveFilters,
  onHostelChange,
  onStatusChange,
  onFromDateChange,
  onToDateChange,
  onClear,
  children,
}: PaymentsFilterPopoverProps) {
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
                aria-label="Reset payment filters"
                title="Reset payment filters"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
            <PopoverClose
              aria-label="Close payment filters"
              title="Close payment filters"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </PopoverClose>
          </div>
        </div>
        <div className="space-y-3">
          {showStatus ? (
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                aria-label="Filter payments by status"
                className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value as "all" | "paid" | "disputed")}
              >
                <option value="all">All status</option>
                <option value="paid">Paid</option>
                <option value="disputed">Disputed</option>
              </select>
            </label>
          ) : null}
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Property
            <select
              aria-label="Filter payments by property"
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
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" />
              Paid on
            </span>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                value={fromDate}
                onChange={onFromDateChange}
                placeholder="From"
                buttonClassName="gap-1 px-2 text-xs"
              />
              <DatePicker
                value={toDate}
                onChange={onToDateChange}
                placeholder="To"
                buttonClassName="gap-1 px-2 text-xs"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
