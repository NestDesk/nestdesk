"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { DatePicker } from "../ui/DatePicker";
import { Button } from "../ui/button";
import { CalendarIcon } from "lucide-react";

export function DateRangeFilter({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStart = searchParams.get("start") || defaultStart;
  const currentEnd = searchParams.get("end") || defaultEnd;

  const [start, setStart] = useState(currentStart);
  const [end, setEnd] = useState(currentEnd);

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", start);
    params.set("end", end);
    router.push(pathname + "?" + params.toString());
  }, [router, pathname, searchParams, start, end]);

  return (
    <div className="rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Date range
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">Filter subscription activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a custom start and end date to refresh the admin summary instantly.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:justify-end">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2 sm:flex-row">
            <div className="w-full min-w-[10rem] flex-1">
              <DatePicker
                value={start}
                onChange={setStart}
                placeholder="Start date"
              />
            </div>
            <span className="px-1 text-sm font-medium text-muted-foreground">to</span>
            <div className="w-full min-w-[10rem] flex-1">
              <DatePicker value={end} onChange={setEnd} placeholder="End date" />
            </div>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={apply}
            disabled={start === currentStart && end === currentEnd}
            className="h-10 w-full rounded-xl px-4 shadow-sm lg:h-9 lg:w-auto"
          >
            Apply filter
          </Button>
        </div>
      </div>
    </div>
  );
}