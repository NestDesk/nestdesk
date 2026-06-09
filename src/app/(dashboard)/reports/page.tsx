"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
} from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  BarChart2,
  Building2,
  CalendarDays,
  Download,
  Home,
  IndianRupee,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { DatePicker } from "../../../components/ui/DatePicker";
import { ReportChart } from "../../../components/reports/ReportChart";
import { exportToCSV } from "../../../lib/reports/exportUtils";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hostel {
  id: string;
  name: string;
}
interface Filters {
  startDate: string;
  endDate: string;
  hostelIds: string[];
}

interface FinancialKPI {
  totalCollected: number;
  totalExpenses: number;
  netOperatingIncome: number;
  outstandingDues: number;
}
interface FinancialChartRow {
  month: string;
  income: number;
  expenses: number;
  noi: number;
}
interface FinancialRow {
  id: string;
  tenant_name: string;
  room_number: string;
  hostel_name: string;
  amount: number;
  month: string;
  status: string;
  method: string;
  paid_on: string | null;
  receipt_number: string | null;
}

interface OccupancyKPI {
  totalBeds: number;
  occupiedBeds: number;
  vacancyRate: number;
  newMoveIns: number;
  moveOuts: number;
  avgStayDays: number;
}
interface OccupancyChartRow {
  property: string;
  totalRooms: number;
  occupiedFullRooms: number;
  occupiedPartialRooms: number;
  inactiveRooms: number;
  maintenanceRooms: number;
  vacantRooms: number;
}
interface OccupancyRow {
  id: string;
  room_number: string;
  hostel_name: string;
  capacity: number;
  occupied: number;
  vacant: number;
  status: string;
}

interface DefaultersKPI {
  totalDefaulters: number;
  totalOverdue: number;
  disputed: number;
  bucket30: number;
}
interface DefaultersRow {
  id: string;
  tenant_name: string;
  phone: string;
  room_number: string;
  hostel_name: string;
  amount: number;
  month: string;
  status: string;
  aging_days: number;
  bucket: string;
}

interface MaintenanceKPI {
  total: number;
  open: number;
  avgResolutionDays: number;
  completed: number;
}
interface MaintenanceChartRow {
  property: string;
  total: number;
  open: number;
  completed: number;
}
interface MaintenanceRow {
  id: string;
  title: string;
  category: string;
  hostel_name: string;
  room_number: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FiltersCtx = createContext<{
  filters: Filters;
  set: (f: Partial<Filters>) => void;
}>({
  filters: { startDate: "", endDate: "", hostelIds: [] },
  set: () => {},
});
function useFilters() {
  return useContext(FiltersCtx);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
function fmtNum(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}
function monthLabel(s: string) {
  if (!s || s.length < 7) return s;
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

async function fetchReport(endpoint: string, filters: Filters) {
  const p = new URLSearchParams();
  if (filters.startDate) p.set("startDate", filters.startDate);
  if (filters.endDate) p.set("endDate", filters.endDate);
  if (filters.hostelIds.length) p.set("hostelIds", filters.hostelIds.join(","));
  const res = await fetch(`/api/reports/${endpoint}?${p}`);
  if (!res.ok) throw new Error(`Failed to load ${endpoint} report`);
  return res.json();
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3 shadow-sm">
      <div className="rounded-lg bg-muted p-2 mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-2xl font-bold mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  disputed:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  open: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
  in_progress:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  resolved:
    "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-300",
  closed:
    "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/15 dark:text-zinc-300",
  occupied_full:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
  occupied_partial:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
  vacant:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  maintenance:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  inactive:
    "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/15 dark:text-zinc-300",
};

const STATUS_LABELS: Record<string, string> = {
  occupied_full: "Fully occupied",
  occupied_partial: "Partially occupied",
  vacant: "Vacant",
  maintenance: "Maintenance",
  inactive: "Inactive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_COLORS[status] ?? "border-zinc-200 bg-zinc-50 text-zinc-600",
      )}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Generic Table ────────────────────────────────────────────────────────────

type ReportColumn<T extends object> =
  | ColumnDef<T, string>
  | ColumnDef<T, number>
  | ColumnDef<T, boolean>
  | ColumnDef<T, Date>
  | ColumnDef<T, null>
  | ColumnDef<T, undefined>
  | ColumnDef<T, string | null>
  | ColumnDef<T, number | null>
  | ColumnDef<T, boolean | null>;

function ReportTable<T extends object>({
  columns,
  data,
  fileName,
}: {
  columns: ReportColumn<T>[];
  data: T[];
  fileName: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-8 text-sm"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8"
          onClick={() =>
            exportToCSV(data as Record<string, unknown>[], `${fileName}.csv`)
          }
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/30">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    style={{
                      cursor: header.column.getCanSort() ? "pointer" : "default",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2.5 whitespace-nowrap text-sm"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={100}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No records found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} row
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ─── TAB 1: Financial Cash Flow ───────────────────────────────────────────────

const finCol = createColumnHelper<FinancialRow>();
const finCols = [
  finCol.accessor("tenant_name", { header: "Tenant" }),
  finCol.accessor("hostel_name", { header: "Property" }),
  finCol.accessor("room_number", { header: "Room" }),
  finCol.accessor("amount", {
    header: "Amount",
    cell: (c) => fmt(c.getValue()),
    sortingFn: "basic",
  }),
  finCol.accessor("month", { header: "Month" }),
  finCol.accessor("status", {
    header: "Status",
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  finCol.accessor("method", { header: "Method" }),
  finCol.accessor("paid_on", {
    header: "Paid On",
    cell: (c) => c.getValue() ?? "—",
  }),
  finCol.accessor("receipt_number", {
    header: "Receipt",
    cell: (c) => c.getValue() ?? "—",
  }),
];

function FinancialTab({ isDark }: { isDark: boolean }) {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<FinancialKPI | null>(null);
  const [chart, setChart] = useState<FinancialChartRow[]>([]);
  const [rows, setRows] = useState<FinancialRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await fetchReport("financial", filters)) as {
        data: {
          kpis: FinancialKPI;
          chart: FinancialChartRow[];
          table: FinancialRow[];
        };
      };
      setKpis(res.data.kpis);
      setChart(res.data.chart);
      setRows(res.data.table);
    } catch {
      toast.error("Failed to load financial report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const noi = kpis?.netOperatingIncome ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Rent Collected"
          value={fmt(kpis?.totalCollected ?? 0)}
          icon={IndianRupee}
          sub="Paid in period"
        />
        <KPICard
          label="Total Expenses"
          value={fmt(kpis?.totalExpenses ?? 0)}
          icon={TrendingDown}
          sub="Paid expenses in period"
        />
        <KPICard
          label="Net Operating Income"
          value={fmt(noi)}
          icon={noi >= 0 ? TrendingUp : TrendingDown}
          sub={noi >= 0 ? "Surplus" : "Deficit"}
        />
        {/* <KPICard
          label="Outstanding Dues"
          value={fmt(kpis?.outstandingDues ?? 0)}
          icon={IndianRupee}
          sub="All pending / disputed"
        /> */}
      </div>

      {chart.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <p className="text-sm font-semibold mb-3">
            Monthly Rent Collected vs Expenses
          </p>
          <ReportChart
            id="fin-chart"
            type="bar"
            stacked={false}
            isDark={isDark}
            categories={chart.map((c) => monthLabel(c.month))}
            series={[
              { name: "Rent Collected", data: chart.map((c) => c.income) },
              { name: "Expenses", data: chart.map((c) => c.expenses) },
            ]}
            colors={["#6366f1", "#f59e0b"]}
            yFormatter={fmt}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ReportTable columns={finCols} data={rows} fileName="financial-report" />
      )}
    </div>
  );
}

// ─── TAB 2: Occupancy & Churn ─────────────────────────────────────────────────

const occCol = createColumnHelper<OccupancyRow>();
const occCols = [
  occCol.accessor("hostel_name", { header: "Property" }),
  occCol.accessor("room_number", { header: "Room" }),
  occCol.accessor("capacity", { header: "Capacity", sortingFn: "basic" }),
  occCol.accessor("occupied", { header: "Occupied", sortingFn: "basic" }),
  occCol.accessor("vacant", { header: "Vacant", sortingFn: "basic" }),
  occCol.accessor("status", {
    header: "Status",
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
];

function OccupancyTab({ isDark }: { isDark: boolean }) {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<OccupancyKPI | null>(null);
  const [chart, setChart] = useState<OccupancyChartRow[]>([]);
  const [rows, setRows] = useState<OccupancyRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await fetchReport("occupancy", filters)) as {
        data: {
          kpis: OccupancyKPI;
          chart: OccupancyChartRow[];
          table: OccupancyRow[];
        };
      };
      setKpis(res.data.kpis);
      setChart(res.data.chart);
      setRows(res.data.table);
    } catch {
      toast.error("Failed to load occupancy report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard
          label="Total Beds"
          value={fmtNum(kpis?.totalBeds ?? 0)}
          icon={Home}
          sub="Across all properties"
        />
        <KPICard
          label="Occupied Beds"
          value={fmtNum(kpis?.occupiedBeds ?? 0)}
          icon={Users}
          sub="Active tenants"
        />
        <KPICard
          label="Vacancy Rate"
          value={`${kpis?.vacancyRate ?? 0}%`}
          icon={Building2}
          sub="Empty beds / total"
        />
        <KPICard
          label="New Move-ins"
          value={fmtNum(kpis?.newMoveIns ?? 0)}
          icon={TrendingUp}
          sub="In selected period"
        />
        <KPICard
          label="Move-outs"
          value={fmtNum(kpis?.moveOuts ?? 0)}
          icon={TrendingDown}
          sub="In selected period"
        />
        <KPICard
          label="Avg Stay"
          value={`${kpis?.avgStayDays ?? 0}d`}
          icon={CalendarDays}
          sub="Across all tenants"
        />
      </div>

      {chart.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <p className="text-sm font-semibold mb-3">Room Status by Property</p>
          <ReportChart
            id="occ-chart"
            type="bar"
            stacked={false}
            isDark={isDark}
            categories={chart.map((c) => c.property)}
            series={[
              { name: "Total Rooms", data: chart.map((c) => c.totalRooms) },
              {
                name: "Fully occupied",
                data: chart.map((c) => c.occupiedFullRooms),
              },
              {
                name: "Partially occupied",
                data: chart.map((c) => c.occupiedPartialRooms),
              },
              { name: "Inactive", data: chart.map((c) => c.inactiveRooms) },
              { name: "Maintenance", data: chart.map((c) => c.maintenanceRooms) },
              { name: "Vacant", data: chart.map((c) => c.vacantRooms) },
            ]}
            colors={[
              "#6b7280",
              "#2563eb",
              "#38bdf8",
              "#64748b",
              "#f59e0b",
              "#10b981",
            ]}
            yFormatter={fmtNum}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ReportTable columns={occCols} data={rows} fileName="occupancy-report" />
      )}
    </div>
  );
}

// ─── TAB 3: Payment Defaulters ────────────────────────────────────────────────

const defCol = createColumnHelper<DefaultersRow>();
const defCols = [
  defCol.accessor("tenant_name", { header: "Tenant" }),
  defCol.accessor("phone", { header: "Phone" }),
  defCol.accessor("hostel_name", { header: "Property" }),
  defCol.accessor("room_number", { header: "Room" }),
  defCol.accessor("amount", {
    header: "Amount",
    cell: (c) => fmt(c.getValue()),
    sortingFn: "basic",
  }),
  defCol.accessor("month", { header: "Month" }),
  defCol.accessor("status", {
    header: "Status",
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  defCol.accessor("aging_days", { header: "Aging (d)", sortingFn: "basic" }),
  defCol.accessor("bucket", { header: "Bucket" }),
];

function DefaultersTab({ isDark }: { isDark: boolean }) {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<DefaultersKPI | null>(null);
  const [rows, setRows] = useState<DefaultersRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await fetchReport("defaulters", filters)) as {
        data: { kpis: DefaultersKPI; table: DefaultersRow[] };
      };
      setKpis(res.data.kpis);
      setRows(res.data.table);
    } catch {
      toast.error("Failed to load defaulters report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const buckets = useMemo(() => {
    const bMap = new Map<string, number>();
    for (const r of rows) bMap.set(r.bucket, (bMap.get(r.bucket) ?? 0) + r.amount);
    return Array.from(bMap.entries()).map(([b, amount]) => ({ bucket: b, amount }));
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Defaulters"
          value={fmtNum(kpis?.totalDefaulters ?? 0)}
          icon={Users}
          sub="Unique tenants with dues"
        />
        <KPICard
          label="Total Overdue"
          value={fmt(kpis?.totalOverdue ?? 0)}
          icon={IndianRupee}
          sub="All unpaid amounts"
        />
        <KPICard
          label="Disputed"
          value={fmt(kpis?.disputed ?? 0)}
          icon={TrendingDown}
          sub="Status = disputed"
        />
        <KPICard
          label="0–30 Day Dues"
          value={fmt(kpis?.bucket30 ?? 0)}
          icon={CalendarDays}
          sub="Early warning bucket"
        />
      </div>

      {buckets.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <p className="text-sm font-semibold mb-3">Overdue by Aging Bucket</p>
          <ReportChart
            id="def-chart"
            type="bar"
            isDark={isDark}
            categories={buckets.map((b) => b.bucket)}
            series={[{ name: "Amount Overdue", data: buckets.map((b) => b.amount) }]}
            colors={["#ef4444"]}
            yFormatter={fmt}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ReportTable columns={defCols} data={rows} fileName="defaulters-report" />
      )}
    </div>
  );
}

// ─── TAB 4: Maintenance & Operations ─────────────────────────────────────────

const mntCol = createColumnHelper<MaintenanceRow>();
const mntCols = [
  mntCol.accessor("title", { header: "Title" }),
  mntCol.accessor("category", { header: "Category" }),
  mntCol.accessor("hostel_name", { header: "Property" }),
  mntCol.accessor("room_number", { header: "Room" }),
  mntCol.accessor("status", {
    header: "Status",
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  mntCol.accessor("created_at", { header: "Raised" }),
  mntCol.accessor("updated_at", { header: "Updated" }),
];

function MaintenanceTab({ isDark }: { isDark: boolean }) {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<MaintenanceKPI | null>(null);
  const [chart, setChart] = useState<MaintenanceChartRow[]>([]);
  const [rows, setRows] = useState<MaintenanceRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await fetchReport("maintenance", filters)) as {
        data: {
          kpis: MaintenanceKPI;
          chart: MaintenanceChartRow[];
          table: MaintenanceRow[];
        };
      };
      setKpis(res.data.kpis);
      setChart(res.data.chart);
      setRows(res.data.table);
    } catch {
      toast.error("Failed to load maintenance report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Total Tickets"
          value={fmtNum(kpis?.total ?? 0)}
          icon={Wrench}
          sub="All in period"
        />
        <KPICard
          label="Open Backlog"
          value={fmtNum(kpis?.open ?? 0)}
          icon={TrendingDown}
          sub="Open / in progress"
        />
        <KPICard
          label="Completed"
          value={fmtNum(kpis?.completed ?? 0)}
          icon={TrendingUp}
          sub="Resolved tickets"
        />
        <KPICard
          label="Avg Resolution"
          value={`${kpis?.avgResolutionDays ?? 0}d`}
          icon={CalendarDays}
          sub="Days to close"
        />
      </div>

      {chart.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <p className="text-sm font-semibold mb-3">Tickets by Property</p>
          <ReportChart
            id="mnt-chart"
            type="bar"
            stacked
            isDark={isDark}
            categories={chart.map((c) => c.property)}
            series={[
              { name: "Open", data: chart.map((c) => c.open) },
              { name: "Completed", data: chart.map((c) => c.completed) },
            ]}
            colors={["#f59e0b", "#10b981"]}
            yFormatter={fmtNum}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ReportTable columns={mntCols} data={rows} fileName="maintenance-report" />
      )}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "financial", label: "Cash Flow", icon: IndianRupee },
  { id: "occupancy", label: "Occupancy", icon: Building2 },
  { id: "defaulters", label: "Defaulters", icon: Users },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ─── Filters Bar ──────────────────────────────────────────────────────────────

function FiltersBar({ hostels }: { hostels: Hostel[] }) {
  const { filters, set } = useFilters();
  return (
    <div className="rounded-xl border bg-card shadow-sm px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              From
            </span>
            <div className="w-40">
              <DatePicker
                value={filters.startDate || undefined}
                onChange={(v) => set({ startDate: v })}
                placeholder="Start date"
                max={filters.endDate || undefined}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              To
            </span>
            <div className="w-40">
              <DatePicker
                value={filters.endDate || undefined}
                onChange={(v) => set({ endDate: v })}
                placeholder="End date"
                min={filters.startDate || undefined}
              />
            </div>
          </div>
          {hostels.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                Property
              </span>
              <button
                onClick={() => set({ hostelIds: [] })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filters.hostelIds.length === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                All
              </button>
              {hostels.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    const on = filters.hostelIds.includes(h.id);
                    set({
                      hostelIds: on
                        ? filters.hostelIds.filter((x) => x !== h.id)
                        : [...filters.hostelIds, h.id],
                    });
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filters.hostelIds.includes(h.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {(filters.startDate || filters.endDate || filters.hostelIds.length > 0) && (
          <button
            onClick={() => set({ startDate: "", endDate: "", hostelIds: [] })}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function ReportsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("financial");
  const [filters, setFiltersState] = useState<Filters>(() => ({
    startDate: searchParams?.get("startDate") ?? "",
    endDate: searchParams?.get("endDate") ?? "",
    hostelIds: searchParams?.get("hostelIds")
      ? searchParams.get("hostelIds")!.split(",")
      : [],
  }));
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.startDate) p.set("startDate", filters.startDate);
    if (filters.endDate) p.set("endDate", filters.endDate);
    if (filters.hostelIds.length) p.set("hostelIds", filters.hostelIds.join(","));
    const qs = p.toString();
    router.replace(`/reports${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [filters, router]);

  useEffect(() => {
    fetch("/api/hostels", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setHostels(
          (j.hostels ?? []).map((h: { id: string; name: string }) => ({
            id: h.id,
            name: h.name,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const ctxValue = useMemo(
    () => ({
      filters,
      set: (f: Partial<Filters>) => setFiltersState((prev) => ({ ...prev, ...f })),
    }),
    [filters],
  );

  return (
    <FiltersCtx.Provider value={ctxValue}>
      <div className="space-y-5">
        <div className="sticky top-0 z-20 pt-1 pb-2 bg-background/80 backdrop-blur-sm -mx-1 px-1">
          <FiltersBar hostels={hostels} />
        </div>

        {/* tab strip */}
        <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm w-full overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center",
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "financial" && <FinancialTab isDark={isDark} />}
        {activeTab === "occupancy" && <OccupancyTab isDark={isDark} />}
        {activeTab === "defaulters" && <DefaultersTab isDark={isDark} />}
        {activeTab === "maintenance" && <MaintenanceTab isDark={isDark} />}
      </div>
    </FiltersCtx.Provider>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-primary/10 p-2">
          <BarChart2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Deep operational insights across your portfolio
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ReportsShell />
      </Suspense>
    </div>
  );
}
