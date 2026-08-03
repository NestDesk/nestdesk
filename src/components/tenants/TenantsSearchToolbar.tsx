import { Funnel, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TenantsFilterPopover } from "./TenantsFilterPopover";
import type { HostelSummary, TenantSortOption } from "./tenant-types";

type TenantsSearchToolbarProps = {
  searchQuery: string;
  statusFilter: string;
  hostelFilter: string;
  paymentStatusFilter: "all" | "paid" | "pending";
  sortOption: TenantSortOption;
  hostels: HostelSummary[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onHostelChange: (value: string) => void;
  onPaymentStatusChange: (value: "all" | "paid" | "pending") => void;
  onSortChange: (value: TenantSortOption) => void;
  onClear: () => void;
};

export function TenantsSearchToolbar({
  searchQuery,
  statusFilter,
  hostelFilter,
  paymentStatusFilter,
  sortOption,
  hostels,
  onSearchChange,
  onStatusChange,
  onHostelChange,
  onPaymentStatusChange,
  onSortChange,
  onClear,
}: TenantsSearchToolbarProps) {
  const hasActiveFilters =
    statusFilter !== "active" ||
    hostelFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    sortOption !== "none";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="relative min-w-0 max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search"
          aria-label="Search tenants"
          className="h-10 border-border/80 bg-muted/30 pl-9 focus-visible:bg-background"
        />
      </div>
      <div className="shrink-0">
        <TenantsFilterPopover
          statusFilter={statusFilter}
          hostelFilter={hostelFilter}
          paymentStatusFilter={paymentStatusFilter}
          sortOption={sortOption}
          hostels={hostels}
          hasActiveFilters={hasActiveFilters}
          onStatusChange={onStatusChange}
          onHostelChange={onHostelChange}
          onPaymentStatusChange={onPaymentStatusChange}
          onSortChange={onSortChange}
          onClear={onClear}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Open tenant filters"
            title="Open tenant filters"
            className="h-10 w-10 shrink-0 border-border/80 bg-muted/30 hover:bg-background"
          >
            <Funnel className="h-4 w-4" />
          </Button>
        </TenantsFilterPopover>
      </div>
    </div>
  );
}