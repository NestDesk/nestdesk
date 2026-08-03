import { BarChart3, Receipt } from "lucide-react";
import { cn } from "../../lib/utils";

type ExpensesTabsProps = {
  activeTab: "expense" | "summary";
  onTabChange: (tab: "expense" | "summary") => void;
};

export function ExpensesTabs({ activeTab, onTabChange }: ExpensesTabsProps) {
  return (
    <div className="border-b border-border/70">
      <div className="flex gap-5 sm:gap-7" role="tablist" aria-label="Expense views">
        <button
          type="button"
          role="tab"
          id="expense-tab"
          aria-controls="expense-panel"
          aria-selected={activeTab === "expense"}
          onClick={() => onTabChange("expense")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "expense"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <Receipt className="h-4 w-4" />
          Expense
        </button>
        <button
          type="button"
          role="tab"
          id="expense-summary-tab"
          aria-controls="expense-summary-panel"
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