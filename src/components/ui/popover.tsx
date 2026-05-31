import * as React from "react";

export const Popover: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}> = ({ open, onOpenChange, children }) => {
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onOpenChange]);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {children}
    </div>
  );
};

export const PopoverTrigger: React.FC<{
  asChild?: boolean;
  children: React.ReactNode;
}> = ({ children }) => {
  return <>{children}</>;
};

export const PopoverContent: React.FC<{
  align?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ className = "", children }) => {
  return (
    <div
      className={`absolute z-50 mt-2 w-auto rounded-md border bg-popover p-2 shadow-lg ${className}`}
      style={{ minWidth: 240 }}
    >
      {children}
    </div>
  );
};
