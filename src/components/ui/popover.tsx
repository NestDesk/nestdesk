import * as React from "react";
import { createPortal } from "react-dom";

type PopoverContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerElement: HTMLElement | null;
  setTriggerElement: (element: HTMLElement | null) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used inside Popover");
  }
  return context;
}

export const Popover: React.FC<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}> = ({ open: controlledOpen, defaultOpen = false, onOpenChange, children }) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const [triggerElement, setTriggerElement] = React.useState<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }, [controlledOpen, onOpenChange]);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerElement !== target &&
        !triggerElement?.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        handleOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, handleOpenChange, triggerElement]);

  return (
    <PopoverContext.Provider
      value={{
        open,
        onOpenChange: handleOpenChange,
        triggerElement,
        setTriggerElement,
        contentRef,
      }}
    >
      <div className="relative inline-block" ref={popoverRef}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger: React.FC<{
  asChild?: boolean;
  children: React.ReactNode;
}> = ({ asChild = false, children }) => {
  const { open, onOpenChange, setTriggerElement } = usePopoverContext();

  if (!asChild) {
    return (
      <button
        type="button"
        ref={setTriggerElement}
        onClick={() => onOpenChange(!open)}
      >
        {children}
      </button>
    );
  }

  const child = React.Children.only(children) as React.ReactElement<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;

  return React.cloneElement(child, {
    ref: setTriggerElement,
    onClick: (event) => {
      child.props.onClick?.(event);
      if (!event.defaultPrevented) {
        onOpenChange(!open);
      }
    },
  });
};

export const PopoverClose: React.FC<{
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  title?: string;
}> = ({ children, className, ...props }) => {
  const { onOpenChange } = usePopoverContext();

  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  );
};

export const PopoverContent: React.FC<{
  align?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ className = "", children }) => {
  const { open, contentRef, triggerElement } = usePopoverContext();
  const [position, setPosition] = React.useState({ top: 0, right: 8 });

  React.useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerElement) return;
      const rect = triggerElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, triggerElement]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={contentRef}
      className={`fixed z-[100] w-auto rounded-md border bg-popover p-2 shadow-lg ${className}`}
      style={{ minWidth: 240, top: position.top, right: position.right }}
    >
      {children}
    </div>,
    document.body,
  );
};
