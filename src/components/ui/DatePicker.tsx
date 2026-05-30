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
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function formatIsoDate(value?: string) {
  const date = parseIsoDate(value);
  return date ? format(date, "dd-MMM-yyyy").toUpperCase() : "";
}

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  value,
  onChange,
  placeholder = "Select date",
  min,
  max,
  disabled,
  className = "",
}) => {
  const selectedDate = React.useMemo(() => parseIsoDate(value), [value]);
  const formattedValue = React.useMemo(() => formatIsoDate(value), [value]);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    () => selectedDate ?? new Date(),
  );
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const minDate = React.useMemo(() => parseIsoDate(min), [min]);
  const maxDate = React.useMemo(() => parseIsoDate(max), [max]);

  const monthStart = React.useMemo(
    () => startOfMonth(calendarMonth),
    [calendarMonth],
  );
  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(monthStart);
    const end = endOfWeek(endOfMonth(monthStart));
    const days: Date[] = [];
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
      const popupHeight = 316;
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
    if (selectedDate) {
      setCalendarMonth(selectedDate);
    }
  }, [selectedDate]);

  const isDisabledDay = React.useCallback(
    (day: Date) =>
      Boolean(
        (minDate && isBefore(day, minDate)) || (maxDate && isAfter(day, maxDate)),
      ),
    [minDate, maxDate],
  );

  const handleSelect = (day: Date) => {
    if (disabled || isDisabledDay(day)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const moveMonth = (delta: number) => {
    setCalendarMonth((current) => addMonths(current, delta));
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-left text-sm font-medium text-foreground",
          "flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          open && "border-primary ring-1 ring-primary/30 shadow-sm",
        )}
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 min-w-0 truncate leading-5">
          {formattedValue ? (
            <span className="text-foreground">{formattedValue}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        {formattedValue ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
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
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold text-foreground">
                {format(calendarMonth, "MMMM yyyy")}
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
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
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate
                  ? isSameDay(day, selectedDate)
                  : false;
                const disabledDay = disabled || isDisabledDay(day);
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
                      isSelected && "bg-primary text-primary-foreground shadow-sm",
                      !isSelected && !disabledDay && "hover:bg-muted",
                      isToday &&
                        !isSelected &&
                        "border border-primary/50 text-primary",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>,
          wrapperRef.current ?? document.body,
        )}
    </div>
  );
};
