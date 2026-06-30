import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface ValidationItem {
  id: string;
  label: string;
  completed: boolean;
}

interface ValidationChecklistProps {
  items: ValidationItem[];
  className?: string;
}

export function ValidationChecklist({
  items,
  className,
}: ValidationChecklistProps) {
  const incompleteItems = items.filter((item) => !item.completed);
  const completedItems = items.filter((item) => item.completed);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/50 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3">
            Complete these requirements to create your account:
          </p>
          <div className="space-y-2">
            {/* Show incomplete items */}
            {incompleteItems.length > 0 && (
              <div className="space-y-2">
                {incompleteItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Show completed items with animation */}
            {completedItems.length > 0 && (
              <div className="space-y-2 mt-2 pt-2 border-t border-amber-200/30 dark:border-amber-900/30">
                {completedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 animate-in fade-in slide-in-from-left-2 duration-300"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="line-through text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
