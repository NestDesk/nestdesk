"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDisplayDate(date: Date) {
  return format(date, "dd-MMM-yyyy").toUpperCase();
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date range",
  minDate,
  maxDate,
  disabled,
  className = "",
}) => {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    () => value.from ?? new Date(),
  );
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const range = value;

  const monthStart = React.useMemo(
    () => startOfMonth(calendarMonth),
    [calendarMonth],
  );
  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(monthStart);
    const end = endOfWeek(endOfMonth(monthStart));
    const days = [] as Date[];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [monthStart]);

  React.useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (
        !wrapperRef.current?.contains(event.target as Node) &&
        !popoverRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !wrapperRef.current) {
      setPosition(null);
      return;
    }

    const update = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) {
        setPosition(null);
        return;
      }

      const width = Math.min(rect.width, 320);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const popupHeight = 340;
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - 8 - popupHeight;
      const top =
        belowTop + popupHeight > window.innerHeight && aboveTop > 0
          ? aboveTop
          : belowTop;

      setPosition({ top, left });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (range.from) {
      setCalendarMonth(range.from);
    }
  }, [range.from]);

  const isDisabledDay = React.useCallback(
    (day: Date) =>
      Boolean(
        disabled ||
        (minDate && isBefore(day, minDate)) ||
        (maxDate && isAfter(day, maxDate)),
      ),
    [disabled, minDate, maxDate],
  );

  const isInRange = React.useCallback(
    (day: Date) =>
      range.from && range.to
        ? isWithinInterval(day, { start: range.from, end: range.to })
        : false,
    [range.from, range.to],
  );

  const handleSelect = (day: Date) => {
    if (isDisabledDay(day)) return;

    if (!range.from || (range.from && range.to)) {
      onChange({ from: day, to: null });
      return;
    }

    if (range.from && !range.to) {
      if (isBefore(day, range.from)) {
        onChange({ from: day, to: range.from });
      } else {
        onChange({ from: range.from, to: day });
      }
    }
  };

  const moveMonth = (delta: number) => {
    setCalendarMonth((current) => addMonths(current, delta));
  };

  function TriggerLabel() {
    if (range.from && range.to) {
      return (
        <span className="flex items-center gap-1 text-foreground min-w-0">
          <span className="font-medium">{formatDisplayDate(range.from)}</span>
          <span className="text-muted-foreground mx-0.5">–</span>
          <span className="font-medium">{formatDisplayDate(range.to)}</span>
        </span>
      );
    }
    if (range.from) {
      return (
        <span className="flex items-center gap-1 text-foreground min-w-0">
          <span className="font-medium">{formatDisplayDate(range.from)}</span>
          <span className="text-muted-foreground">– ...</span>
        </span>
      );
    }
    return <span className="text-muted-foreground text-sm">{placeholder}</span>;
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-9 w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm",
          "hover:bg-accent/60 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          open && "border-primary ring-1 ring-primary/30",
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0 text-left">
          <TriggerLabel />
        </span>
        {(range.from || range.to) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onChange({ from: null, to: null });
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            className="z-[10000] overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: Math.min(
                position.left ? window.innerWidth - position.left - 8 : 320,
                320,
              ),
              maxWidth: "min(calc(100vw - 1rem), 320px)",
            }}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {range.from && !range.to
                      ? "Select end date"
                      : "Select start date"}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {format(calendarMonth, "MMMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="flex h-7 items-center justify-center text-center font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 px-3 pb-3">
              {calendarDays.map((day) => {
                const isStart = range.from ? isSameDay(day, range.from) : false;
                const isEnd = range.to ? isSameDay(day, range.to) : false;
                const inRange =
                  range.from && range.to
                    ? isWithinInterval(day, { start: range.from, end: range.to })
                    : false;
                const disabledDay = isDisabledDay(day);
                const outside = !isSameMonth(day, monthStart);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    disabled={disabledDay}
                    className={cn(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      outside && "text-muted-foreground/40",
                      disabledDay && "text-muted-foreground/30 cursor-not-allowed",
                      (isStart || isEnd) &&
                        "bg-primary text-primary-foreground shadow-sm",
                      inRange && !isStart && !isEnd && "bg-primary/10 text-primary",
                      !disabledDay && !isStart && !isEnd && "hover:bg-muted",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
