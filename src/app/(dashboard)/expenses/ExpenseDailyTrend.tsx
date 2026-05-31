"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useIsMobile } from "../../../hooks/use-mobile";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type DailyTotal = {
  date: string;
  total: number;
};

type Props = {
  dailyTotals: DailyTotal[];
  isDarkTheme: boolean;
  className?: string;
};

export default function ExpenseDailyTrend({
  dailyTotals,
  isDarkTheme,
  className,
}: Props) {
  const isMobile = useIsMobile();

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const chartOptions = useMemo<ApexOptions>(() => {
    const color = isDarkTheme ? "#06b6d4" : "#0ea5e9";
    // Compute how many labels we can reasonably display based on viewport
    const approxLabelWidth = isMobile ? 96 : 120; // px per label, larger = fewer labels
    const maxLabels = Math.max(2, Math.floor(viewportWidth / approxLabelWidth));
    const len = dailyTotals.length;
    const desiredLabels = Math.min(len, maxLabels);
    // Compute a step so we show roughly `desiredLabels` labels evenly.
    const step = len > 0 ? Math.max(1, Math.ceil(len / desiredLabels)) : 1;
    const indices = new Set<number>();
    for (let i = 0; i < len; i += step) indices.add(i);
    const tickAmount = Math.max(0, Math.floor((len - 1) / step));

    return {
      chart: {
        id: "expenseDailyTrend",
        toolbar: { show: false },
        animations: { enabled: true, speed: 450 },
        fontFamily: "inherit",
      },
      grid: {
        borderColor: "hsl(var(--border))",
        strokeDashArray: 3,
      },
      dataLabels: { enabled: false },
      xaxis: {
        // categories hold full date strings so tooltip can show complete date
        categories: dailyTotals.map((row) => row.date),
        tickAmount,
        labels: {
          show: true,
          style: { colors: "hsl(var(--muted-foreground))", fontSize: "10px" },
          rotate: 0,
          rotateAlways: false,
          formatter: (val: string) => {
            const d = new Date(val + "T00:00:00");
            return String(d.getDate());
          },
          trim: true,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: {
          show: true,
          position: "back",
          stroke: {
            color: "hsl(var(--border))",
            width: 1,
            dashArray: 3,
          },
        },
      },
      yaxis: {
        min: 0,
        labels: {
          style: { colors: "hsl(var(--muted-foreground))", fontSize: "10px" },
          formatter: (val: number) =>
            new Intl.NumberFormat("en-IN", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(val),
        },
      },
      colors: [color],
      plotOptions: {
        bar: {
          borderRadius: 0,
        },
      },
      fill: {
        colors: [color],
        opacity: 1,
      },
      tooltip: {
        shared: true,
        intersect: false,
        x: {
          // show full date in tooltip
          formatter: (val: string) => {
            try {
              const d = new Date(val + "T00:00:00");
              return d.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
            } catch {
              return String(val);
            }
          },
        },
        y: {
          formatter: (value: number) =>
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(value),
        },
      },
      legend: { show: false },
    } as ApexOptions;
  }, [dailyTotals, isDarkTheme, isMobile, viewportWidth]);

  const series = useMemo(
    () => [
      {
        name: "Expenses",
        data: dailyTotals.map((r) => Number(r.total)),
      },
    ],
    [dailyTotals],
  );

  return (
    <div
      className={className ?? "w-full flex-1"}
      style={{ width: "100%", height: "100%" }}
    >
      <ApexChart
        type="bar"
        options={chartOptions}
        series={series}
        width="100%"
        height="100%"
      />
    </div>
  );
}
