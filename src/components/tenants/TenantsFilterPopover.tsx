import * as React from "react";
import { ArrowUpDown, ListFilter, RotateCcw, X } from "lucide-react";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { SORT_OPTION_LABELS, STATUS_OPTIONS } from "./tenant-constants";
import type { HostelSummary, TenantSortOption } from "./tenant-types";

type TenantsFilterPopoverProps = {
  statusFilter: string;
  hostelFilter: string;
  paymentStatusFilter: "all" | "paid" | "pending";
  sortOption: TenantSortOption;
  hostels: HostelSummary[];
  hasActiveFilters: boolean;
  onStatusChange: (value: string) => void;
  onHostelChange: (value: string) => void;
  onPaymentStatusChange: (value: "all" | "paid" | "pending") => void;
  onSortChange: (value: TenantSortOption) => void;
  onClear: () => void;
  children: React.ReactNode;
};

export function TenantsFilterPopover({
  statusFilter,
  hostelFilter,
  paymentStatusFilter,
  sortOption,
  hostels,
  hasActiveFilters,
  onStatusChange,
  onHostelChange,
  onPaymentStatusChange,
  onSortChange,
  onClear,
  children,
}: TenantsFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="right-0 max-h-[calc(100dvh-1rem)] w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
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
                  aria-label="Reset filters"
                  title="Reset filters"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
              <PopoverClose
                aria-label="Close filters"
                title="Close filters"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </PopoverClose>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                aria-label="Filter by status"
                className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Property
              <select
                aria-label="Filter by property"
                className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
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
              Rent status
              <select
                aria-label="Filter by rent status"
                className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                value={paymentStatusFilter}
                onChange={(event) =>
                  onPaymentStatusChange(
                    event.target.value as "all" | "paid" | "pending",
                  )
                }
              >
                <option value="all">All rent status</option>
                <option value="paid">Rent paid</option>
                <option value="pending">Rent pending</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort
              </span>
              <select
                aria-label="Sort tenants"
                className="h-9 w-full rounded-md border border-input bg-muted/30 px-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                value={sortOption}
                onChange={(event) =>
                  onSortChange(event.target.value as TenantSortOption)
                }
              >
                <option value="none">{SORT_OPTION_LABELS.none}</option>
                <option value="room_number">{SORT_OPTION_LABELS.room_number}</option>
                <option value="join_date">{SORT_OPTION_LABELS.join_date}</option>
                <option value="profile_completion">
                  {SORT_OPTION_LABELS.profile_completion}
                </option>
                <option value="rent_amount">{SORT_OPTION_LABELS.rent_amount}</option>
              </select>
            </label>
          </div>
      </PopoverContent>
    </Popover>
  );
}