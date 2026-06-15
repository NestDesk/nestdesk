"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface SeriesItem {
  name: string;
  data: number[];
}

interface ReportChartProps {
  id: string;
  type: "bar" | "line" | "area";
  categories: string[];
  series: SeriesItem[];
  colors?: string[];
  height?: number;
  isDark?: boolean;
  stacked?: boolean;
  yFormatter?: (v: number) => string;
}

export function ReportChart({
  id,
  type,
  categories,
  series,
  colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"],
  height = 260,
  isDark = false,
  stacked = false,
  yFormatter,
}: ReportChartProps) {
  const options: ApexOptions = {
    chart: {
      id,
      type,
      stacked,
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
      fontFamily: "inherit",
      background: "transparent",
    },
    theme: { mode: isDark ? "dark" : "light" },
    colors,
    grid: {
      borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
      strokeDashArray: 3,
      padding: { left: 4, right: 4 },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: type === "bar" ? 0 : 2.5 },
    fill:
      type === "area"
        ? { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0.05 } }
        : { type: "solid", opacity: 0.85 },
    xaxis: {
      categories,
      labels: {
        style: { colors: isDark ? "#9ca3af" : "#6b7280", fontSize: "11px" },
        rotate: -30,
        trim: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: isDark ? "#9ca3af" : "#6b7280", fontSize: "11px" },
        formatter: yFormatter ?? ((v) => String(v)),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: isDark ? "#d1d5db" : "#374151" },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: { formatter: yFormatter ?? ((v) => String(v)) },
    },
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: "60%" },
    },
  };

  return (
    <ApexChart
      type={type}
      options={options}
      series={series}
      height={height}
      width="100%"
    />
  );
}
