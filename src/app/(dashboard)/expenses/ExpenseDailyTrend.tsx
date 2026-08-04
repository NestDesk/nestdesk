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

type DailyPropertyTotal = {
  hostel_id: string;
  hostel_name: string;
  totals: DailyTotal[];
};

type Props = {
  dailyTotals: DailyTotal[];
  dailyPropertyTotals: DailyPropertyTotal[];
  isDarkTheme: boolean;
  className?: string;
};

export default function ExpenseDailyTrend({
  dailyTotals,
  dailyPropertyTotals,
  isDarkTheme,
  className,
}: Props) {
  const isMobile = useIsMobile();
  const [isMounted, setIsMounted] = useState(false);

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const chartOptions = useMemo<ApexOptions>(() => {
    const colors = isDarkTheme
      ? ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa"]
      : ["#0284c7", "#7c3aed", "#059669", "#d97706", "#e11d48", "#2563eb"];
    // Compute how many labels we can reasonably display based on viewport
    const approxLabelWidth = isMobile ? 96 : 120; // px per label, larger = fewer labels
    const maxLabels = Math.max(2, Math.floor(viewportWidth / approxLabelWidth));
    const len = dailyTotals.length;
    const desiredLabels = Math.min(len, maxLabels);
    const tickAmount = Math.max(1, desiredLabels - 1);

    return {
      chart: {
        id: "expenseDailyTrend",
        background: "transparent",
        foreColor: isDarkTheme ? "#94a3b8" : "#64748b",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: false,
            zoom: false,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
          autoSelected: "pan",
        },
        zoom: {
          enabled: true,
          type: "x",
          autoScaleYaxis: true,
          allowMouseWheelZoom: false,
        },
        animations: { enabled: false },
        fontFamily: "inherit",
      },
      theme: { mode: isDarkTheme ? "dark" : "light" },
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
      colors,
      fill: {
        colors,
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
        y: {
          formatter: (value: number) =>
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(value),
        },
      },
      legend: {
        show: dailyPropertyTotals.length > 1,
        position: "top",
        horizontalAlign: "left",
        labels: { colors: isDarkTheme ? "#cbd5e1" : "#475569" },
        markers: { size: 5 },
      },
    } as ApexOptions;
  }, [dailyPropertyTotals.length, dailyTotals, isDarkTheme, isMobile, viewportWidth]);

  const series = useMemo(
    () =>
      dailyPropertyTotals.length > 0
        ? dailyPropertyTotals.map((property) => ({
            name: property.hostel_name,
            data: property.totals.map((row) => Number(row.total)),
          }))
        : [{ name: "Expenses", data: dailyTotals.map((row) => Number(row.total)) }],
    [dailyPropertyTotals, dailyTotals],
  );

  return (
    <div
      className={className ?? "h-72 w-full"}
      style={{ width: "100%" }}
    >
      {isMounted ? (
        <ApexChart
          type="area"
          options={chartOptions}
          series={series}
          width="100%"
          height="100%"
        />
      ) : null}
    </div>
  );
}
