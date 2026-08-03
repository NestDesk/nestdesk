import { BookOpen, CheckCircle2, IndianRupee } from "lucide-react";
import { cn } from "../../lib/utils";

type PaymentsTabsProps = {
  activeTab: "payments" | "summary" | "ledger";
  onTabChange: (tab: "payments" | "summary" | "ledger") => void;
};

export function PaymentsTabs({ activeTab, onTabChange }: PaymentsTabsProps) {
  return (
    <div className="border-b border-border/70">
      <div className="flex gap-5 sm:gap-7" role="tablist" aria-label="Payment views">
        <button
          type="button"
          role="tab"
          id="payments-tab"
          aria-controls="payments-panel"
          aria-selected={activeTab === "payments"}
          onClick={() => onTabChange("payments")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <IndianRupee className="h-4 w-4" />
          Payments
        </button>
        <button
          type="button"
          role="tab"
          id="payment-summary-tab"
          aria-controls="payment-summary-panel"
          aria-selected={activeTab === "summary"}
          onClick={() => onTabChange("summary")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "summary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Summary
        </button>
        <button
          type="button"
          role="tab"
          id="payment-ledger-tab"
          aria-controls="payment-ledger-panel"
          aria-selected={activeTab === "ledger"}
          onClick={() => onTabChange("ledger")}
          className={cn(
            "relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === "ledger"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <BookOpen className="h-4 w-4" />
          Ledger
        </button>
      </div>
    </div>
  );
}
