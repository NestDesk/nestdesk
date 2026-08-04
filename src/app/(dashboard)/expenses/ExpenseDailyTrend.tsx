"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { formatDateInIndia } from "../../../lib/date";
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
    const color = isDarkTheme ? "#22d3ee" : "#0284c7";
    const tooltipBackground = isDarkTheme ? "#111827" : "#ffffff";
    const tooltipText = isDarkTheme ? "#f8fafc" : "#0f172a";
    const tooltipMutedText = isDarkTheme ? "#94a3b8" : "#64748b";
    const tooltipBorder = isDarkTheme ? "#334155" : "#e2e8f0";
    // Compute how many labels we can reasonably display based on viewport
    const approxLabelWidth = isMobile ? 96 : 120; // px per label, larger = fewer labels
    const maxLabels = Math.max(2, Math.floor(viewportWidth / approxLabelWidth));
    const len = dailyTotals.length;
    const desiredLabels = Math.min(len, maxLabels);
    const tickAmount = Math.max(1, desiredLabels - 1);

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
        tickPlacement: "on",
        labels: {
          show: true,
          style: { colors: "hsl(var(--muted-foreground))", fontSize: "10px" },
          rotate: isMobile ? -45 : 0,
          rotateAlways: isMobile,
          hideOverlappingLabels: false,
          showDuplicates: true,
          formatter: (val: string) => {
            const d = new Date(val + "T00:00:00");
            if (Number.isNaN(d.getTime())) return val;
            return d.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            });
          },
          trim: false,
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
      fill: {
        colors: [color],
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.32,
          opacityTo: 0.04,
          stops: [0, 90, 100],
        },
      },
      stroke: { curve: "smooth", width: 2 },
      markers: {
        size: 0,
        hover: { size: 5, sizeOffset: 2 },
      },
      tooltip: {
        theme: isDarkTheme ? "dark" : "light",
        shared: true,
        intersect: false,
        marker: { show: true },
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
          const date = w.globals.categoryLabels[dataPointIndex] ?? "";
          const amount = Number(series[seriesIndex]?.[dataPointIndex] ?? 0);
          const formattedDate = formatDateInIndia(`${date}T00:00:00`, {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const formattedAmount = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(amount);

          return `<div style="background:${tooltipBackground};border:1px solid ${tooltipBorder};border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,0.18);padding:10px 12px;min-width:150px;color:${tooltipText};font-family:inherit">
            <div style="color:${tooltipMutedText};font-size:11px;margin-bottom:4px">${formattedDate}</div>
            <div style="display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
              <span>${formattedAmount}</span>
            </div>
          </div>`;
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
      className={className ?? "h-72 w-full"}
      style={{ width: "100%" }}
    >
      <ApexChart
        type="area"
        options={chartOptions}
        series={series}
        width="100%"
        height="100%"
      />
    </div>
  );
}
