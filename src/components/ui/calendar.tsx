import * as React from "react";
import { isSameDay, isWithinInterval, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  mode?: "range" | "single";
  selected: { from: Date | null; to: Date | null } | Date | null;
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Controlled: which month to display */
  viewMonth: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Show/hide nav arrows */
  showPrev?: boolean;
  showNext?: boolean;
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const Calendar: React.FC<CalendarProps> = ({
  mode = "range",
  selected,
  onSelect,
  minDate,
  maxDate,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  showPrev = true,
  showNext = true,
}) => {
  const today = startOfDay(new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Build grid cells: null = blank offset, Date = real day
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const from =
    mode === "range" && selected
      ? (selected as { from: Date | null; to: Date | null }).from
      : null;
  const to =
    mode === "range" && selected
      ? (selected as { from: Date | null; to: Date | null }).to
      : null;

  const rangeStart = React.useMemo(() => {
    if (!from) return null;
    if (!to) return from;
    return to < from ? to : from;
  }, [from, to]);

  const rangeEnd = React.useMemo(() => {
    if (!to) return from;
    if (!from) return to;
    return to < from ? from : to;
  }, [from, to]);

  const isStart = (d: Date) => !!rangeStart && isSameDay(d, rangeStart);
  const isEnd = (d: Date) => !!rangeEnd && isSameDay(d, rangeEnd) && !!to;
  const isRange = (d: Date) =>
    !!(
      rangeStart &&
      rangeEnd &&
      !isSameDay(d, rangeStart) &&
      !isSameDay(d, rangeEnd) &&
      isWithinInterval(d, { start: rangeStart, end: rangeEnd })
    );
  const isToday = (d: Date) => isSameDay(d, today);

  const monthLabel = viewMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-3 w-[268px] shrink-0 select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3 h-8">
        <button
          type="button"
          onClick={onPrevMonth}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors",
            !showPrev && "invisible pointer-events-none",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button
          type="button"
          onClick={onNextMonth}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors",
            !showNext && "invisible pointer-events-none",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} className="h-8" />;

          const disabled =
            !!(minDate && day < minDate) || !!(maxDate && day > maxDate);
          const start = isStart(day);
          const end = isEnd(day);
          const inRange = isRange(day);
          const todayDay = isToday(day);
          const isSingleDay = !!(from && to && isSameDay(from, to));

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "h-8 flex items-center justify-center relative",
                // range middle strip
                inRange && "bg-primary/10 dark:bg-primary/15",
                // left half strip at end
                end &&
                  rangeStart &&
                  !isSingleDay &&
                  "bg-gradient-to-r from-primary/10 to-transparent dark:from-primary/15",
                // right half strip at start
                start &&
                  rangeEnd &&
                  !isSingleDay &&
                  "bg-gradient-to-l from-primary/10 to-transparent dark:from-primary/15",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onSelect(day)}
                className={cn(
                  "h-8 w-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors relative z-10",
                  // disabled
                  disabled && "opacity-30 cursor-not-allowed pointer-events-none",
                  // selected start/end
                  (start || end) &&
                    "bg-primary text-primary-foreground hover:bg-primary/90 ring-0",
                  // today ring when not selected
                  todayDay && !start && !end && "ring-1 ring-primary text-primary",
                  // hover for normal days
                  !disabled && !start && !end && "hover:bg-accent text-foreground",
                  // in-range text
                  inRange && !start && !end && "text-foreground",
                )}
              >
                {day.getDate()}
              </button>
              {(start || end) && (
                <span className="absolute -bottom-4 text-[9px] uppercase tracking-[0.15em] text-primary">
                  {start ? "start" : "end"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
