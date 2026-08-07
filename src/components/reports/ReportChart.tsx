"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import ApexCharts from "apexcharts";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { ApexOptions } from "apexcharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<{
    index: number;
    left: number;
    top: number;
  } | null>(null);

  const shareChart = async () => {
    try {
      const { blob } = await ApexCharts.exec(id, "dataURI");
      const file = blob ? new File([blob], `${id}.png`, { type: "image/png" }) : null;

      if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: "NestDesk report chart",
          text: "Shared from NestDesk",
          files: [file],
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      toast.success("Report link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Unable to share this chart");
    }
  };

  const options: ApexOptions = {
    chart: {
      id,
      type,
      stacked,
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
      fontFamily: "inherit",
      background: "transparent",
      events: {
        dataPointSelection: (event, _chartContext, config) => {
          const index = config.dataPointIndex;
          const rect = chartContainerRef.current?.getBoundingClientRect();
          if (index < 0 || !rect) return;

          const currentPoint = selectedPoint?.index === index ? null : {
            index,
            left: event.clientX - rect.left,
            top: event.clientY - rect.top,
          };
          setSelectedPoint(currentPoint);
        },
        click: (_event, _chartContext, config) => {
          if (config.dataPointIndex < 0) setSelectedPoint(null);
        },
      },
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
    <div ref={chartContainerRef} className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={shareChart}
              aria-label="Share chart"
              className="absolute right-0 top-0 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground dark:bg-card/90"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Share chart</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ApexChart
        type={type}
        options={options}
        series={series}
        height={height}
        width="100%"
      />
      {selectedPoint && (
        <div
          className="pointer-events-none absolute z-20 min-w-36 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
          style={{ left: selectedPoint.left, top: selectedPoint.top - 8 }}
        >
          <p className="mb-1 font-semibold">{categories[selectedPoint.index]}</p>
          <div className="space-y-0.5">
            {series.map((item, seriesIndex) => (
              <div key={`${item.name}-${seriesIndex}`} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">
                  {(yFormatter ?? ((value: number) => String(value)))(
                    item.data[selectedPoint.index] ?? 0,
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
