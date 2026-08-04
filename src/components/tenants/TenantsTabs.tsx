import { BarChart3, UsersRound } from "lucide-react";
import { cn } from "../../lib/utils";

type TenantsTabsProps = {
  activeTab: "tenants" | "summary";
  onTabChange: (tab: "tenants" | "summary") => void;
};

export function TenantsTabs({ activeTab, onTabChange }: TenantsTabsProps) {
  return (
    <div className="border-b border-border/70">
      <div
        className="flex  gap-5 sm:justify-start sm:gap-7"
        role="tablist"
        aria-label="Tenant views"
      >
        <button
          type="button"
          role="tab"
          id="tenants-tab"
          aria-controls="tenants-panel"
          aria-selected={activeTab === "tenants"}
          onClick={() => onTabChange("tenants")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "tenants"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <UsersRound className="h-4 w-4" />
          Tenants
        </button>
        <button
          type="button"
          role="tab"
          id="summary-tab"
          aria-controls="summary-panel"
          aria-selected={activeTab === "summary"}
          onClick={() => onTabChange("summary")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "summary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Summary
        </button>
      </div>
    </div>
  );
}
