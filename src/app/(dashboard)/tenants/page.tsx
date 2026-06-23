"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateInIndia } from "../../../lib/date";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileImage,
  IndianRupee,
  Loader2,
  Receipt,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  X,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { DatePicker } from "../../../components/ui/DatePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  RecordPaymentModal,
  type PaymentMethod,
} from "../../../components/payments/RecordPaymentModal";
import { calculateRent } from "../../../lib/billing";
import { printInvoice } from "../../../lib/invoice";
import { cn } from "../../../lib/utils";

type TenantStatus = "pending" | "active" | "moved_out" | "rejected";

type TenantRow = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  room_id: string | null;
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  first_activated_at: string | null;
  profile_photo_url: string | null;
  profile_completion_percentage: number;
  agreed_rent_amount: number | null;
  security_deposit: number | null;
  security_deposit_returned: number | null;
  join_date: string | null;
  rent_start_date: string | null;
  move_out_date: string | null;
  created_at: string;
  updated_at: string;
};

type HostelSummary = {
  id: string;
  name: string;
  location: string;
};

type RoomSummary = {
  id: string;
  room_number: string;
  status: string;
  capacity: number;
  occupancy: number;
};

type TenantsResponse = {
  tenants: TenantRow[];
  summary: {
    total: number;
    pending: number;
    active: number;
    moved_out: number;
    rejected: number;
  };
  hostels: HostelSummary[];
  roomsByHostel: Record<string, RoomSummary[]>;
};

type TenantDraft = {
  fullName: string;
  phone: string;
  status: TenantStatus;
  roomId: string | null;
  agreedRentAmount: string;
  securityDeposit: string;
  securityDepositReturned: string;
  joinDate: string;
  rentStartDate: string;
  moveOutDate: string;
};

type TenantSortOption =
  | "none"
  | "room_number"
  | "join_date"
  | "profile_completion"
  | "rent_amount";

const SORT_OPTION_LABELS: Record<TenantSortOption, string> = {
  none: "Sort by",
  room_number: "Room number",
  join_date: "Joined date",
  profile_completion: "Profile completion",
  rent_amount: "Rent amount",
};

type TenantProfileDetail = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  room_id: string | null;
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  occupation_type: string | null;
  institution_name: string | null;
  aadhar_last4: string | null;
  profile_photo_url: string | null;
  aadhar_front_url: string | null;
  aadhar_back_url: string | null;
  alternate_id_url: string | null;
  profile_completion_percentage: number;
  profile_completion_missing: string[];
  agreed_rent_amount: number | null;
  security_deposit: number | null;
  security_deposit_returned: number | null;
  join_date: string | null;
  rent_start_date: string | null;
  move_out_date: string | null;
  first_activated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovalDraft = {
  roomId: string;
  agreedRentAmount: string;
  securityDeposit: string;
  joinDate: string;
  rentStartDate: string;
};

const STATUS_CHIP_CLASS: Record<TenantStatus, string> = {
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  active:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  moved_out:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
  rejected:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
};

const AVATAR_BG: Record<TenantStatus, string> = {
  pending: "from-amber-400 to-orange-500",
  active: "from-emerald-400 to-teal-500",
  moved_out: "from-slate-400 to-slate-500",
  rejected: "from-rose-400 to-rose-600",
};

const AVATAR_STATUS_DOT: Record<TenantStatus, string> = {
  pending: "bg-amber-500",
  active: "bg-emerald-500",
  moved_out: "bg-slate-500",
  rejected: "bg-rose-500",
};

const STATUS_OPTIONS: Array<{ value: TenantStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "moved_out", label: "Moved Out" },
  { value: "rejected", label: "Rejected" },
];

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutCountryCode = digits.startsWith("91") ? digits.slice(2) : digits;
  return withoutCountryCode.slice(0, 10);
}

function normalizeRentInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("").slice(0, 2);

  if (!whole && !fraction) {
    return "";
  }

  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole || "0"}.${fraction}`;
}

function formatDate(date: string | null) {
  return formatDateInIndia(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: TenantStatus) {
  return status.replace("_", " ");
}

function formatCurrency(amount: number | null) {
  if (!amount || amount <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month) return monthStr;
  return formatDateInIndia(new Date(year, month - 1, 1), {
    month: "short",
    year: "numeric",
  });
}

type TenantPaymentCoverage = {
  status: "paid" | "pending";
  coveredTill: string | null;
  pendingFrom: string | null;
  pendingTo: string | null;
  pendingAmount: number;
  pendingBreakdown: PendingBreakdownItem[];
};

type PendingBreakdownItem = {
  monthLabel: string;
  start: string;
  end: string;
  occupiedDays: number;
  daysInMonth: number;
  amount: number;
  isPartial: boolean;
};

type PaymentCoverageRow = {
  tenant_id: string;
  billing_end: string | null;
  status: "paid" | "disputed";
};

function parseISODate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function calculatePendingBreakdown(
  monthlyRent: number,
  pendingFrom: string,
  pendingTo: string,
) {
  let cursor = parseISODate(pendingFrom);
  const end = parseISODate(pendingTo);
  const rows: PendingBreakdownItem[] = [];

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const monthEnd = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + 1,
      0,
    );
    const periodEnd = monthEnd < end ? monthEnd : end;

    const calc = calculateRent(
      monthlyRent,
      toISODate(periodStart),
      toISODate(periodEnd),
    );

    rows.push({
      monthLabel: formatDateInIndia(periodStart, {
        month: "short",
        year: "numeric",
      }),
      start: toISODate(periodStart),
      end: toISODate(periodEnd),
      occupiedDays: calc.occupiedDays,
      daysInMonth: calc.daysInMonth,
      amount: calc.payableAmount,
      isPartial: calc.isProrated,
    });

    cursor = new Date(periodEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

type PaymentHistoryItem = {
  id: string;
  amount: number;
  month: string;
  billing_start: string | null;
  billing_end: string | null;
  status: "paid" | "disputed";
  method: string | null;
  receipt_number: string | null;
  notes: string | null;
  paid_at: string | null;
  paid_on: string;
  created_at: string;
  tenant_name: string;
  room_number: string | null;
  hostel_name: string;
  hostel_address: string | null;
  hostel_city: string | null;
  hostel_state: string | null;
  hostel_pincode: string | null;
  hostel_billing_address: string | null;
  hostel_gst_number: string | null;
  hostel_pan_number: string | null;
};

type PaymentHistorySummary = {
  totalPaid: number;
  disputedAmount: number;
  total: number;
};

export default function OwnerTenantsPage() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [summary, setSummary] = useState<TenantsResponse["summary"]>({
    total: 0,
    pending: 0,
    active: 0,
    moved_out: 0,
    rejected: 0,
  });
  const [hostels, setHostels] = useState<HostelSummary[]>([]);
  const [roomsByHostel, setRoomsByHostel] = useState<Record<string, RoomSummary[]>>(
    {},
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [hostelFilter, setHostelFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [sortOption, setSortOption] = useState<TenantSortOption>("none");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TenantDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTenant, setReviewTenant] = useState<TenantProfileDetail | null>(null);
  const [approveSaving, setApproveSaving] = useState(false);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>({
    roomId: "",
    agreedRentAmount: "",
    securityDeposit: "",
    joinDate: "",
    rentStartDate: "",
  });

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentTenantId, setRecordPaymentTenantId] = useState<string | null>(
    null,
  );
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);
  const [recordPaymentExistingPayments, setRecordPaymentExistingPayments] = useState<
    Array<{ tenant_id: string; month: string; billing_end?: string | null }>
  >([]);

  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [paymentHistoryTenant, setPaymentHistoryTenant] = useState<TenantRow | null>(
    null,
  );
  const [paymentHistoryItems, setPaymentHistoryItems] = useState<
    PaymentHistoryItem[]
  >([]);
  const [paymentHistorySummary, setPaymentHistorySummary] =
    useState<PaymentHistorySummary>({ totalPaid: 0, disputedAmount: 0, total: 0 });
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentCoverageByTenant, setPaymentCoverageByTenant] = useState<
    Record<string, TenantPaymentCoverage>
  >({});
  const [pendingInfoOpen, setPendingInfoOpen] = useState(false);
  const [pendingInfoTenant, setPendingInfoTenant] = useState<TenantRow | null>(null);
  const [summaryAccordionValue, setSummaryAccordionValue] = useState<string[]>([]);
  const [filterAccordionValue, setFilterAccordionValue] = useState<string[]>([]);
  const [pendingInfoDetail, setPendingInfoDetail] =
    useState<TenantPaymentCoverage | null>(null);

  const loadPaymentCoverage = useCallback(async (tenantRows: TenantRow[]) => {
    const activeRows = tenantRows.filter(
      (tenant) =>
        (tenant.status === "active" || tenant.status === "moved_out") &&
        !!tenant.rent_start_date &&
        !!tenant.agreed_rent_amount &&
        tenant.agreed_rent_amount > 0,
    );

    if (activeRows.length === 0) {
      setPaymentCoverageByTenant({});
      return;
    }

    try {
      const response = await fetch("/api/payments?status=paid", {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        payments?: PaymentCoverageRow[];
        error?: string;
      };

      if (!response.ok) {
        toast.error(json.error ?? "Could not load payment status.");
        return;
      }

      const payments = json.payments ?? [];
      const latestPaidEndByTenant = new Map<string, string>();

      for (const payment of payments) {
        if (payment.status !== "paid" || !payment.billing_end) continue;
        const current = latestPaidEndByTenant.get(payment.tenant_id);
        if (!current || payment.billing_end > current) {
          latestPaidEndByTenant.set(payment.tenant_id, payment.billing_end);
        }
      }

      const today = toISODate(new Date());
      const nextCoverage: Record<string, TenantPaymentCoverage> = {};

      for (const tenant of activeRows) {
        const coveredTill = latestPaidEndByTenant.get(tenant.id) ?? null;
        const effectiveEnd =
          tenant.status === "moved_out" && tenant.move_out_date
            ? tenant.move_out_date
            : today;

        if (coveredTill && coveredTill >= effectiveEnd) {
          nextCoverage[tenant.id] = {
            status: "paid",
            coveredTill,
            pendingFrom: null,
            pendingTo: null,
            pendingAmount: 0,
            pendingBreakdown: [],
          };
          continue;
        }

        const pendingFrom = coveredTill
          ? addDays(coveredTill, 1)
          : tenant.rent_start_date!;

        if (pendingFrom > effectiveEnd) {
          nextCoverage[tenant.id] = {
            status: "paid",
            coveredTill,
            pendingFrom: null,
            pendingTo: null,
            pendingAmount: 0,
            pendingBreakdown: [],
          };
          continue;
        }

        const pendingBreakdown = calculatePendingBreakdown(
          Number(tenant.agreed_rent_amount),
          pendingFrom,
          effectiveEnd,
        );
        const pendingAmount =
          Math.round(
            pendingBreakdown.reduce((sum, row) => sum + row.amount, 0) * 100,
          ) / 100;

        nextCoverage[tenant.id] = {
          status: pendingAmount > 0 ? "pending" : "paid",
          coveredTill,
          pendingFrom: pendingAmount > 0 ? pendingFrom : null,
          pendingTo: pendingAmount > 0 ? effectiveEnd : null,
          pendingAmount: pendingAmount > 0 ? pendingAmount : 0,
          pendingBreakdown: pendingAmount > 0 ? pendingBreakdown : [],
        };
      }

      setPaymentCoverageByTenant(nextCoverage);
    } catch {
      toast.error("Network error while loading payment status.");
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tenants", { cache: "no-store" });
      const json = (await response.json()) as TenantsResponse | { error?: string };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not load tenants.");
        return;
      }

      const payload = json as TenantsResponse;
      setTenants(payload.tenants ?? []);
      setSummary(payload.summary);
      setHostels(payload.hostels ?? []);
      setRoomsByHostel(payload.roomsByHostel ?? {});
      await loadPaymentCoverage(payload.tenants ?? []);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loadPaymentCoverage]);

  useEffect(() => {
    loadTenants().catch(() => {
      // handled in loadTenants
    });
  }, [loadTenants]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncAccordions = () => {
      setSummaryAccordionValue(mediaQuery.matches ? ["summary-cards"] : []);
      setFilterAccordionValue(mediaQuery.matches ? ["filters-panel"] : []);
    };

    syncAccordions();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncAccordions);
      return () => mediaQuery.removeEventListener("change", syncAccordions);
    }

    mediaQuery.addListener(syncAccordions);
    return () => mediaQuery.removeListener(syncAccordions);
  }, []);

  const filteredTenants = useMemo(() => {
    const matches = tenants.filter((tenant) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        tenant.full_name.toLowerCase().includes(query) ||
        (tenant.email ?? "").toLowerCase().includes(query) ||
        (tenant.phone ?? "").includes(query) ||
        (tenant.room_number ?? "").toLowerCase().includes(query) ||
        tenant.hostel_name.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
      const matchesHostel =
        hostelFilter === "all" || tenant.hostel_id === hostelFilter;
      const coverage = paymentCoverageByTenant[tenant.id];
      const matchesPaymentStatus =
        paymentStatusFilter === "all" ||
        (coverage ? coverage.status === paymentStatusFilter : false);

      return matchesQuery && matchesStatus && matchesHostel && matchesPaymentStatus;
    });

    if (sortOption === "none") {
      return matches;
    }

    return [...matches].sort((a, b) => {
      if (sortOption === "room_number") {
        const aRoom = Number(a.room_number ?? "") || Number.POSITIVE_INFINITY;
        const bRoom = Number(b.room_number ?? "") || Number.POSITIVE_INFINITY;
        return aRoom - bRoom;
      }

      if (sortOption === "join_date") {
        const aDate = a.join_date ? new Date(a.join_date).getTime() : 0;
        const bDate = b.join_date ? new Date(b.join_date).getTime() : 0;
        return bDate - aDate;
      }

      if (sortOption === "profile_completion") {
        return b.profile_completion_percentage - a.profile_completion_percentage;
      }

      if (sortOption === "rent_amount") {
        return (b.agreed_rent_amount ?? 0) - (a.agreed_rent_amount ?? 0);
      }

      return 0;
    });
  }, [
    hostelFilter,
    paymentCoverageByTenant,
    paymentStatusFilter,
    searchQuery,
    sortOption,
    statusFilter,
    tenants,
  ]);

  function startEdit(tenant: TenantRow) {
    setEditingId(tenant.id);
    setDrafts((prev) => {
      const joinDate = tenant.join_date ?? "";
      const rentStartDate = tenant.rent_start_date ?? joinDate;
      return {
        ...prev,
        [tenant.id]: {
          fullName: tenant.full_name,
          phone: normalizePhone(tenant.phone ?? ""),
          status: tenant.status,
          roomId: tenant.room_id,
          agreedRentAmount:
            tenant.agreed_rent_amount != null
              ? String(tenant.agreed_rent_amount)
              : "",
          securityDeposit:
            tenant.security_deposit != null ? String(tenant.security_deposit) : "",
          securityDepositReturned:
            tenant.security_deposit_returned != null
              ? String(tenant.security_deposit_returned)
              : "",
          joinDate,
          rentStartDate,
          moveOutDate: tenant.move_out_date ?? "",
        },
      };
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function updateDraft(
    tenantId: string,
    field: keyof TenantDraft,
    value: string | TenantStatus | null,
  ) {
    setDrafts((prev) => {
      const current = prev[tenantId];
      if (!current) return prev;
      // If joinDate changes and rentStartDate matches old joinDate, update rentStartDate too
      if (field === "joinDate") {
        if (current.rentStartDate === current.joinDate) {
          return {
            ...prev,
            [tenantId]: {
              ...current,
              joinDate: value as string,
              rentStartDate: value as string,
            },
          };
        }
      }
      return {
        ...prev,
        [tenantId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  function allRoomsForHostel(hostelId: string, currentRoomId: string | null = null) {
    const allRooms = roomsByHostel[hostelId] ?? [];
    return allRooms.sort((a, b) => {
      // Current room first, then sort by room number in ascending order
      if (a.id === currentRoomId) return -1;
      if (b.id === currentRoomId) return 1;
      const aNum = parseInt(a.room_number) || 0;
      const bNum = parseInt(b.room_number) || 0;
      return aNum - bNum;
    });
  }

  async function saveTenant(tenant: TenantRow) {
    const draft = drafts[tenant.id];
    if (!draft) {
      toast.error("Edit form not ready. Please try again.");
      return;
    }

    if (!draft.fullName || !draft.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    const normalizedPhone = normalizePhone(draft.phone);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
      toast.error("Valid 10-digit phone number is required.");
      return;
    }

    if (draft.status === "active" && !draft.roomId) {
      toast.error("Room assignment is required.");
      return;
    }

    if (draft.status === "active" && !draft.securityDeposit) {
      toast.error("Security deposit amount is required to activate a tenant.");
      return;
    }

    if (draft.status === "moved_out" && draft.securityDepositReturned === "") {
      toast.error("Security deposit returned amount is required when moving out.");
      return;
    }

    if (draft.status === "moved_out" && !draft.moveOutDate) {
      toast.error("Move-out date is required when moving out.");
      return;
    }

    if (
      draft.status === "moved_out" &&
      draft.moveOutDate &&
      draft.joinDate &&
      draft.moveOutDate < draft.joinDate
    ) {
      toast.error("Move-out date cannot be before join date.");
      return;
    }

    if (draft.status !== "moved_out" && !draft.agreedRentAmount) {
      toast.error("Agreed rent amount is required.");
      return;
    }

    if (draft.status !== "moved_out" && !draft.joinDate) {
      toast.error("Join date is required.");
      return;
    }

    if (draft.status !== "moved_out" && !draft.rentStartDate) {
      toast.error("Rent start date is required.");
      return;
    }

    setSavingId(tenant.id);

    try {
      const payload = {
        fullName: draft.fullName.trim(),
        phone: normalizedPhone,
        status: draft.status,
        roomId: draft.status === "active" ? draft.roomId : null,
        agreedRentAmount: draft.agreedRentAmount
          ? Number(draft.agreedRentAmount)
          : null,
        securityDeposit: draft.securityDeposit
          ? Number(draft.securityDeposit)
          : null,
        securityDepositReturned:
          draft.status === "moved_out" && draft.securityDepositReturned !== ""
            ? Number(draft.securityDepositReturned)
            : null,
        joinDate: draft.joinDate || null,
        rentStartDate: draft.rentStartDate || null,
        moveOutDate: draft.status === "moved_out" ? draft.moveOutDate || null : null,
      };

      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as
        | { error?: string }
        | {
            success: boolean;
            tenant?: {
              id: string;
              hostel_id: string;
              room_id: string | null;
              full_name: string;
              email: string | null;
              phone: string | null;
              status: TenantStatus;
              first_activated_at: string | null;
              agreed_rent_amount: number | null;
              security_deposit: number | null;
              join_date: string | null;
              rent_start_date: string | null;
              move_out_date: string | null;
              created_at: string;
              updated_at: string;
            };
          };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not update tenant.");
        return;
      }

      const updatedTenant = "tenant" in json ? json.tenant : undefined;
      setTenants((prev) =>
        prev.map((row) => {
          if (row.id !== tenant.id) return row;

          if (!updatedTenant) {
            return {
              ...row,
              full_name: payload.fullName,
              phone: payload.phone || null,
              status: payload.status,
              first_activated_at: row.first_activated_at,
              profile_completion_percentage: row.profile_completion_percentage,
              room_id: payload.roomId,
              agreed_rent_amount: payload.agreedRentAmount,
              room_number:
                (roomsByHostel[row.hostel_id] ?? []).find(
                  (room) => room.id === payload.roomId,
                )?.room_number ?? null,
              security_deposit: payload.securityDeposit,
              join_date: payload.joinDate,
              rent_start_date: payload.rentStartDate,
              move_out_date: payload.moveOutDate,
              updated_at: new Date().toISOString(),
            };
          }

          return {
            ...row,
            full_name: updatedTenant.full_name,
            email: updatedTenant.email,
            phone: updatedTenant.phone,
            status: updatedTenant.status,
            first_activated_at: updatedTenant.first_activated_at,
            profile_completion_percentage: row.profile_completion_percentage,
            room_id: updatedTenant.room_id,
            agreed_rent_amount: updatedTenant.agreed_rent_amount,
            room_number:
              (roomsByHostel[row.hostel_id] ?? []).find(
                (room) => room.id === updatedTenant.room_id,
              )?.room_number ?? null,
            security_deposit: updatedTenant.security_deposit,
            join_date: updatedTenant.join_date,
            rent_start_date: updatedTenant.rent_start_date,
            move_out_date: updatedTenant.move_out_date,
            updated_at: updatedTenant.updated_at,
          };
        }),
      );

      setSummary((prev) => {
        const next = {
          total: tenants.length,
          pending: 0,
          active: 0,
          moved_out: 0,
          rejected: 0,
        };

        tenants.forEach((row) => {
          const candidate =
            row.id === tenant.id ? { ...row, status: draft.status } : row;
          if (candidate.status === "pending") next.pending += 1;
          if (candidate.status === "active") next.active += 1;
          if (candidate.status === "moved_out") next.moved_out += 1;
          if (candidate.status === "rejected") next.rejected += 1;
        });

        return { ...prev, ...next };
      });

      setEditingId(null);
      loadTenants().catch(() => {
        // refresh fallback
      });
      toast.success("Tenant updated successfully.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function maskAadhaar(value: string | null) {
    if (!value || value.length < 4) {
      return "-";
    }
    return `XXXX XXXX ${value.slice(-4)}`;
  }

  async function openReview(tenant: TenantRow) {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewTenant(null);

    setApprovalDraft({
      roomId: tenant.room_id ?? "",
      agreedRentAmount:
        tenant.agreed_rent_amount !== null ? String(tenant.agreed_rent_amount) : "",
      securityDeposit:
        tenant.security_deposit !== null ? String(tenant.security_deposit) : "",
      joinDate: tenant.join_date ?? "",
      rentStartDate: tenant.rent_start_date ?? "",
    });

    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as
        | { error?: string }
        | { tenant?: TenantProfileDetail };

      if (!response.ok) {
        const error = "error" in json ? json.error : undefined;
        toast.error(error ?? "Could not load tenant profile.");
        return;
      }

      const profile = "tenant" in json ? json.tenant : undefined;
      if (!profile) {
        toast.error("Could not load tenant profile.");
        return;
      }

      setReviewTenant(profile);
      setApprovalDraft((prev) => ({
        roomId: profile.room_id ?? prev.roomId,
        agreedRentAmount:
          profile.agreed_rent_amount !== null
            ? String(profile.agreed_rent_amount)
            : prev.agreedRentAmount,
        securityDeposit:
          profile.security_deposit !== null
            ? String(profile.security_deposit)
            : prev.securityDeposit,
        joinDate: profile.join_date ?? prev.joinDate,
        rentStartDate: profile.rent_start_date ?? prev.rentStartDate,
      }));
    } catch {
      toast.error("Network error while loading tenant profile.");
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReview(open: boolean) {
    setReviewOpen(open);
    if (!open) {
      setReviewLoading(false);
      setReviewTenant(null);
      setApproveSaving(false);
    }
  }

  async function openRecordPayment(tenant: TenantRow) {
    setRecordPaymentTenantId(tenant.id);
    setRecordPaymentExistingPayments([]);
    setRecordPaymentOpen(true);
    setRecordPaymentLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/payments`, {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        payments?: Array<{ month: string; billing_end?: string | null }>;
        error?: string;
      };

      if (!response.ok) {
        toast.error(json.error ?? "Could not load tenant payment history.");
        return;
      }

      setRecordPaymentExistingPayments(
        (json.payments ?? []).map((payment) => ({
          tenant_id: tenant.id,
          month: payment.month,
          billing_end: payment.billing_end ?? null,
        })),
      );
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRecordPaymentLoading(false);
    }
  }

  function closeRecordPayment() {
    setRecordPaymentOpen(false);
    setRecordPaymentTenantId(null);
    setRecordPaymentExistingPayments([]);
    setRecordPaymentLoading(false);
  }

  async function openPaymentHistory(tenant: TenantRow) {
    setPaymentHistoryTenant(tenant);
    setPaymentHistoryItems([]);
    setPaymentHistorySummary({ totalPaid: 0, disputedAmount: 0, total: 0 });
    setPaymentHistoryOpen(true);
    setPaymentHistoryLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/payments`);
      const json = (await response.json()) as {
        payments?: PaymentHistoryItem[];
        summary?: PaymentHistorySummary;
        error?: string;
      };
      if (!response.ok) {
        toast.error(json.error ?? "Could not load payment history.");
        return;
      }
      setPaymentHistoryItems(json.payments ?? []);
      setPaymentHistorySummary(
        json.summary ?? { totalPaid: 0, disputedAmount: 0, total: 0 },
      );
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPaymentHistoryLoading(false);
    }
  }

  function closePaymentHistory() {
    setPaymentHistoryOpen(false);
    setPaymentHistoryTenant(null);
  }

  function openPendingInfo(tenant: TenantRow, coverage: TenantPaymentCoverage) {
    setPendingInfoTenant(tenant);
    setPendingInfoDetail(coverage);
    setPendingInfoOpen(true);
  }

  // Compute per-property counts for each status
  const propertyStatusCounts = useMemo(() => {
    const counts: Record<
      string,
      {
        name: string;
        total: number;
        pending: number;
        active: number;
        moved_out: number;
      }
    > = {};
    for (const hostel of hostels) {
      counts[hostel.id] = {
        name: hostel.name,
        total: 0,
        pending: 0,
        active: 0,
        moved_out: 0,
      };
    }
    for (const tenant of tenants) {
      if (!counts[tenant.hostel_id]) continue;
      counts[tenant.hostel_id].total += 1;
      if (tenant.status === "pending") counts[tenant.hostel_id].pending += 1;
      if (tenant.status === "active") counts[tenant.hostel_id].active += 1;
      if (tenant.status === "moved_out") counts[tenant.hostel_id].moved_out += 1;
    }
    return counts;
  }, [hostels, tenants]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Review registrations, approve move-ins, assign rooms, and track tenant
            status.
          </p>
        </div>
      </div>

      <Accordion
        type="multiple"
        value={summaryAccordionValue}
        onValueChange={setSummaryAccordionValue}
        className="w-full"
      >
        <AccordionItem
          value="summary-cards"
          className="overflow-hidden rounded-xl border border-border/70 bg-background"
        >
          <AccordionTrigger className="rounded-none border-none bg-background px-4 py-3 text-left hover:no-underline">
            <span className="text-sm font-semibold text-foreground">
              Tenant summary cards
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/70 bg-background p-0">
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Card */}
              <Card className="rounded-xl border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Total
                      </p>
                      <p className="text-xl font-bold text-foreground">{summary.total}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">
                    {Object.values(propertyStatusCounts).map((item) => (
                      <div key={item.name}>
                        {item.name}: <span className="font-semibold text-foreground">{item.total}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Card */}
              <Card className="rounded-xl border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Active
                      </p>
                      <p className="text-xl font-bold text-foreground">{summary.active}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">
                    {Object.values(propertyStatusCounts).map((item) => (
                      <div key={item.name}>
                        {item.name}: <span className="font-semibold text-foreground">{item.active}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Card */}
              <Card className="rounded-xl border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Pending
                      </p>
                      <p className="text-xl font-bold text-foreground">{summary.pending}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">
                    {Object.values(propertyStatusCounts).map((item) => (
                      <div key={item.name}>
                        {item.name}: <span className="font-semibold text-foreground">{item.pending}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Moved Out Card */}
              <Card className="rounded-xl border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10">
                      <UserX className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Moved Out
                      </p>
                      <p className="text-xl font-bold text-foreground">{summary.moved_out}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">
                    {Object.values(propertyStatusCounts).map((item) => (
                      <div key={item.name}>
                        {item.name}: <span className="font-semibold text-foreground">{item.moved_out}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="multiple"
        value={filterAccordionValue}
        onValueChange={setFilterAccordionValue}
        className="w-full space-y-0.5"
      >
        <AccordionItem
          value="filters-panel"
          className="overflow-hidden rounded-xl border border-border/70 bg-background"
        >
          <AccordionTrigger className="rounded-none border-none bg-background px-4 py-3 text-left hover:no-underline">
            <span className="text-sm font-semibold text-foreground">
              Filters
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/70 bg-background p-0">
            <Card className="rounded-none border-none shadow-none">
              <CardContent className="grid gap-2 p-3 sm:grid-cols-[30%_70%]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, room, or property"
                    className="pl-8 min-w-0"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm"
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
            >
              <option value="all">All properties</option>
              {hostels.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm"
              value={paymentStatusFilter}
              onChange={(e) =>
                setPaymentStatusFilter(e.target.value as "all" | "paid" | "pending")
              }
            >
              <option value="all">All rent status</option>
              <option value="paid">Rent paid</option>
              <option value="pending">Rent pending</option>
            </select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 min-w-[10rem] justify-between"
                    >
                      <span className="truncate text-sm">
                        {SORT_OPTION_LABELS[sortOption]}
                      </span>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setSortOption("room_number")}>
                      Room number
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSortOption("join_date")}>
                      Joined date
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setSortOption("profile_completion")}
                    >
                      Profile completion
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSortOption("rent_amount")}>
                      Rent amount
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setSortOption("none")}>
                      Clear sorting
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <User className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No tenants found
          </p>
          <p className="text-xs text-muted-foreground/70">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTenants.map((tenant) => {
            const isEditing = editingId === tenant.id;
            const draft = drafts[tenant.id];
            const coverage = paymentCoverageByTenant[tenant.id];
            const initials = tenant.full_name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <Card
                key={tenant.id}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-shadow duration-150",
                  isEditing
                    ? "border-primary/30 shadow-md shadow-primary/5"
                    : "border-border/70 hover:border-border hover:shadow-sm",
                )}
              >
                {/* ── Tenant identity row ── */}
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0 sm:flex-row sm:items-center">
                    {/* Left: avatar + status bar */}
                    <div className="flex flex-col gap-3 border-b border-border/60 px-2 py-2 sm:w-[250px] sm:flex-none sm:border-b-0 sm:border-r sm:py-3">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openReview(tenant)}
                          className="relative rounded-xl transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Open ${tenant.full_name} profile review`}
                        >
                          {tenant.profile_photo_url ? (
                            <Image
                              src={tenant.profile_photo_url}
                              alt={`${tenant.full_name} profile`}
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-xl object-cover shadow-sm"
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                                AVATAR_BG[tenant.status],
                              )}
                            >
                              {initials}
                            </div>
                          )}
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white",
                              AVATAR_STATUS_DOT[tenant.status],
                            )}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tenant.full_name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {tenant.email ?? "No email on file"}
                          </p>
                          {tenant.phone ? (
                            <p className="text-[11px] text-muted-foreground">
                              {tenant.phone}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: property / dates / actions */}
                    <div className="flex flex-1 flex-col gap-3 px-2 py-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            {tenant.hostel_name}
                          </span>

                          {(tenant.rent_start_date ?? tenant.join_date) ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                              Rent start{" "}
                              {formatDate(
                                tenant.rent_start_date ?? tenant.join_date,
                              )}
                            </span>
                          ) : null}

                          {tenant.agreed_rent_amount ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <IndianRupee className="h-3 w-3" />
                              {formatCurrency(tenant.agreed_rent_amount)}
                              <span className="font-normal text-muted-foreground">
                                /mo
                              </span>
                            </span>
                          ) : null}

                          <div className="flex w-full flex-wrap items-center gap-2.5">
                            {tenant.room_number ? (
                              <span className="inline-flex max-w-max items-center rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300">
                                Room {tenant.room_number}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                tenant.status === "active"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
                              )}
                            >
                              {tenant.status === "active" ? "KYC done" : `Profile ${tenant.profile_completion_percentage}%`}
                            </span>

                            {coverage ? (
                              <button
                                type="button"
                                onClick={() => openPendingInfo(tenant, coverage)}
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                                  coverage.status === "paid"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                    : "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300",
                                )}
                              >
                                {coverage.status === "paid"
                                  ? "Rent Paid"
                                  : `Rent Pending ${formatAmount(coverage.pendingAmount)}`}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Right side: action buttons */}
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {/* Row 1: Action buttons */}
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {!isEditing ? (
                              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                                <button
                                  type="button"
                                  className="h-8 border-r border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                                  onClick={() => startEdit(tenant)}
                                >
                                  Manage
                                </button>
                                <button
                                  type="button"
                                  className="h-8 border-r border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-emerald-500/5 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-emerald-400 whitespace-nowrap"
                                  onClick={() => openRecordPayment(tenant)}
                                  disabled={tenant.status !== "active"}
                                  title={
                                    tenant.status !== "active"
                                      ? "Tenant must be active to record payments"
                                      : "Record a payment"
                                  }
                                >
                                  Add Payment
                                </button>
                                <button
                                  type="button"
                                  className="h-8 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                  onClick={() => openPaymentHistory(tenant)}
                                  title="View payment history"
                                >
                                  History
                                </button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Manage panel ── */}
                  {isEditing && draft ? (
                    <div className="border-t border-primary/15 bg-gradient-to-br from-primary/[0.03] to-background px-4 pb-5 pt-4">
                      {/* Section: Contact */}
                      <div className="mb-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                          Contact Details
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`name-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Full Name
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <Input
                              id={`name-${tenant.id}`}
                              value={draft.fullName}
                              onChange={(e) =>
                                updateDraft(tenant.id, "fullName", e.target.value)
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`phone-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Phone Number
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <div className="flex items-center overflow-hidden rounded-md border border-input bg-background shadow-sm">
                              <div className="flex h-9 items-center border-r border-input bg-muted/40 px-3 text-sm font-medium text-foreground">
                                +91
                              </div>
                              <Input
                                id={`phone-${tenant.id}`}
                                value={draft.phone}
                                onChange={(e) =>
                                  updateDraft(
                                    tenant.id,
                                    "phone",
                                    normalizePhone(e.target.value),
                                  )
                                }
                                placeholder="9876543210"
                                className="h-9 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mb-4 border-t border-border/50" />

                      {/* Section: Stay & Billing */}
                      <div className="mb-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                          Stay &amp; Billing
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {/* Room */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`room-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Room Assignment
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <select
                              id={`room-${tenant.id}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={draft.roomId ?? ""}
                              disabled={
                                savingId === tenant.id ||
                                draft.status === "moved_out"
                              }
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "roomId",
                                  e.target.value || null,
                                )
                              }
                            >
                              <option value="">Select a room</option>
                              {(roomsByHostel[tenant.hostel_id] ?? [])
                                .sort((a, b) => {
                                  const aNum = parseInt(a.room_number) || 0;
                                  const bNum = parseInt(b.room_number) || 0;
                                  return aNum - bNum;
                                })
                                .map((room) => {
                                  const available = room.capacity - room.occupancy;
                                  const isFull = available === 0;
                                  return (
                                    <option
                                      key={room.id}
                                      value={room.id}
                                      disabled={isFull}
                                    >
                                      Room {room.room_number} ({room.occupancy}/
                                      {room.capacity}){isFull ? " - FULL" : ""}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>

                          {/* Agreed Rent */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`rent-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Agreed Rent/month
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <div className="relative">
                              <IndianRupee className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                id={`rent-${tenant.id}`}
                                value={draft.agreedRentAmount}
                                onChange={(e) =>
                                  updateDraft(
                                    tenant.id,
                                    "agreedRentAmount",
                                    normalizeRentInput(e.target.value),
                                  )
                                }
                                placeholder="Monthly rent"
                                disabled={
                                  savingId === tenant.id ||
                                  draft.status === "moved_out"
                                }
                                className="h-9 w-full pl-8 text-sm"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`security-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Security Deposit
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <div className="relative">
                              <IndianRupee className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                id={`security-${tenant.id}`}
                                value={draft.securityDeposit}
                                onChange={(e) =>
                                  updateDraft(
                                    tenant.id,
                                    "securityDeposit",
                                    normalizeRentInput(e.target.value),
                                  )
                                }
                                placeholder="Security deposit"
                                disabled={
                                  savingId === tenant.id ||
                                  draft.status === "moved_out"
                                }
                                className="h-9 w-full pl-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Join Date */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`join-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Join Date
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <DatePicker
                              id={`join-${tenant.id}`}
                              value={draft.joinDate}
                              disabled={
                                savingId === tenant.id ||
                                draft.status === "moved_out"
                              }
                              onChange={(value) =>
                                updateDraft(tenant.id, "joinDate", value)
                              }
                              placeholder="Select join date"
                              className="h-9 w-full text-sm"
                            />
                          </div>
                          {/* Rent Start Date */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`rentstart-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Rent Start Date
                              <span className="ml-1 text-rose-500">*</span>
                            </Label>
                            <DatePicker
                              id={`rentstart-${tenant.id}`}
                              value={draft.rentStartDate}
                              disabled={
                                savingId === tenant.id ||
                                draft.status === "moved_out"
                              }
                              onChange={(value) =>
                                updateDraft(tenant.id, "rentStartDate", value)
                              }
                              placeholder="Select rent start date"
                              className="h-9 w-full text-sm"
                            />
                          </div>

                          {/* Status */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`status-${tenant.id}`}
                              className="text-xs font-medium"
                            >
                              Status
                            </Label>
                            <select
                              id={`status-${tenant.id}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              value={draft.status}
                              disabled={savingId === tenant.id}
                              onChange={(e) =>
                                updateDraft(
                                  tenant.id,
                                  "status",
                                  e.target.value as TenantStatus,
                                )
                              }
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                  disabled={
                                    option.value === "active" &&
                                    !draft.securityDeposit
                                  }
                                  title={
                                    option.value === "active" &&
                                    !draft.securityDeposit
                                      ? "Fill security deposit before activating"
                                      : undefined
                                  }
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section: Move-out Date (conditional) */}
                      {draft.status === "moved_out" ? (
                        <>
                          <div className="mb-4 border-t border-border/50" />
                          <div className="mb-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                              Move-out
                            </p>
                            <div className="grid gap-3 sm:grid-cols-4">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor={`moveout-${tenant.id}`}
                                  className="text-xs font-medium"
                                >
                                  Move-out Date
                                  <span className="ml-1 text-rose-500">*</span>
                                </Label>
                                <DatePicker
                                  id={`moveout-${tenant.id}`}
                                  value={draft.moveOutDate}
                                  disabled={savingId === tenant.id}
                                  onChange={(value) =>
                                    updateDraft(tenant.id, "moveOutDate", value)
                                  }
                                  placeholder="Select move-out date"
                                  className="h-9 text-sm w-full"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor={`security-returned-${tenant.id}`}
                                  className="text-xs font-medium"
                                >
                                  Security deposit returned
                                  <span className="ml-1 text-rose-500">*</span>
                                </Label>
                                <div className="relative">
                                  <IndianRupee className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    id={`security-returned-${tenant.id}`}
                                    value={draft.securityDepositReturned}
                                    onChange={(e) =>
                                      updateDraft(
                                        tenant.id,
                                        "securityDepositReturned",
                                        normalizeRentInput(e.target.value),
                                      )
                                    }
                                    placeholder="Amount returned"
                                    disabled={savingId === tenant.id}
                                    className="h-9 w-full pl-8 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {/* Footer actions */}
                      <div className="flex items-center justify-end gap-3 border-t border-border/50 pt-4">
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg px-3.5 text-xs"
                            disabled={savingId === tenant.id}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg px-3.5 text-xs font-medium"
                            disabled={savingId === tenant.id}
                            onClick={() => saveTenant(tenant)}
                          >
                            {savingId === tenant.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={reviewOpen} onOpenChange={closeReview}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tenant Profile Review</DialogTitle>
            <DialogDescription>
              Review complete profile and uploaded documents before approving this
              tenant as active.
            </DialogDescription>
          </DialogHeader>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !reviewTenant ? (
            <p className="text-sm text-muted-foreground">
              Unable to load tenant profile.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border/70 p-4 sm:grid-cols-[84px_1fr]">
                {reviewTenant.profile_photo_url ? (
                  <Image
                    src={reviewTenant.profile_photo_url}
                    alt={`${reviewTenant.full_name} profile photo`}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                    {reviewTenant.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {reviewTenant.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.email ?? "No email"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.phone ?? "No phone"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTenant.hostel_name}
                    {reviewTenant.hostel_location
                      ? `, ${reviewTenant.hostel_location}`
                      : ""}
                  </p>
                  <div className="pt-1">
                    <Badge
                      className={cn(
                        "text-[11px]",
                        STATUS_CHIP_CLASS[reviewTenant.status],
                      )}
                    >
                      {statusLabel(reviewTenant.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Occupation</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.occupation_type ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Institution</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.institution_name ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aadhaar</p>
                  <p className="text-sm font-medium text-foreground">
                    {maskAadhaar(reviewTenant.aadhar_last4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profile Completion</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.profile_completion_percentage}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Room Assigned</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.room_number ||
                    (reviewTenant.room_id
                      ? `Room ${allRoomsForHostel(reviewTenant.hostel_id, reviewTenant.room_id).find((room) => room.id === reviewTenant.room_id)?.room_number ?? reviewTenant.room_id}`
                      : "-")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agreed Rent</p>
                  <p className="text-sm font-medium text-foreground">
                    ₹{reviewTenant.agreed_rent_amount ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Security Deposit</p>
                  <p className="text-sm font-medium text-foreground">
                    ₹{reviewTenant.security_deposit ?? 0}
                  </p>
                </div>
                {reviewTenant.status === "moved_out" ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Security Returned</p>
                    <p className="text-sm font-medium text-foreground">
                      ₹{reviewTenant.security_deposit_returned ?? 0}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">Move-out Date</p>
                  <p className="text-sm font-medium text-foreground">
                    {reviewTenant.move_out_date
                      ? formatDate(reviewTenant.move_out_date)
                      : "-"}
                  </p>
                </div>
              </div>

              {reviewTenant.profile_completion_missing.length > 0 ? (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                  Missing: {reviewTenant.profile_completion_missing.join(", ")}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Uploaded Documents
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Aadhaar Front",
                      url: reviewTenant.aadhar_front_url,
                    },
                    {
                      label: "Aadhaar Back",
                      url: reviewTenant.aadhar_back_url,
                    },
                    {
                      label: "Alternate ID",
                      url: reviewTenant.alternate_id_url,
                    },
                  ].map((doc) => (
                    <div
                      key={doc.label}
                      className="rounded-lg border border-border/70 p-2"
                    >
                      <p className="mb-2 text-xs font-medium text-foreground">
                        {doc.label}
                      </p>
                      {doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <Image
                            src={doc.url}
                            alt={doc.label}
                            width={240}
                            height={112}
                            className="h-28 w-full rounded-md object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex h-28 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                          <FileImage className="mr-1 h-3.5 w-3.5" /> Not uploaded
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {reviewTenant.status === "active" ? (
                <div className="space-y-3 rounded-xl border border-border/70 p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Approval
                  </p>

                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <Label htmlFor="approval-room" className="text-xs">
                        Room
                      </Label>
                      <Input
                        id="approval-room"
                        value={
                          allRoomsForHostel(
                            reviewTenant.hostel_id,
                            reviewTenant.room_id,
                          ).find((room) => room.id === reviewTenant.room_id)
                            ?.room_number
                            ? `Room ${allRoomsForHostel(reviewTenant.hostel_id, reviewTenant.room_id).find((room) => room.id === reviewTenant.room_id)?.room_number}`
                            : "No room assigned"
                        }
                        disabled
                        className="mt-1 h-9 w-full"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label htmlFor="approval-rent" className="text-xs">
                        Agreed Rent/Month
                      </Label>
                      <Input
                        id="approval-rent"
                        value={approvalDraft.agreedRentAmount}
                        onChange={(e) =>
                          setApprovalDraft((prev) => ({
                            ...prev,
                            agreedRentAmount: normalizeRentInput(e.target.value),
                          }))
                        }
                        disabled={approveSaving || reviewTenant.status === "active"}
                        className="mt-1 h-9 w-full"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label htmlFor="approval-join-date" className="text-xs">
                        Join Date
                      </Label>
                      <DatePicker
                        id="approval-join-date"
                        value={approvalDraft.joinDate}
                        onChange={(value) =>
                          setApprovalDraft((prev) => ({
                            ...prev,
                            joinDate: value,
                          }))
                        }
                        disabled={approveSaving || reviewTenant.status === "active"}
                        placeholder="Select join date"
                        className="mt-1 h-9 w-full"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label htmlFor="approval-rent-start-date" className="text-xs">
                        Rent Start Date
                      </Label>
                      <DatePicker
                        id="approval-rent-start-date"
                        value={approvalDraft.rentStartDate}
                        onChange={(value) =>
                          setApprovalDraft((prev) => ({
                            ...prev,
                            rentStartDate: value,
                          }))
                        }
                        disabled={approveSaving || reviewTenant.status === "active"}
                        placeholder="Select rent start date"
                        className="mt-1 h-9 w-full"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecordPaymentModal
        open={recordPaymentOpen}
        onClose={closeRecordPayment}
        tenants={tenants}
        tenantsLoading={recordPaymentLoading}
        payments={recordPaymentExistingPayments}
        initialTenantId={recordPaymentTenantId}
        tenantLocked
        onRecorded={() => loadTenants()}
      />

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryOpen} onOpenChange={closePaymentHistory}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Payment History
            </DialogTitle>
            <DialogDescription>
              {paymentHistoryTenant?.full_name} — all recorded payments
            </DialogDescription>
          </DialogHeader>

          {paymentHistoryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : paymentHistoryItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Total Paid
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(paymentHistorySummary.totalPaid)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Disputed
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {formatAmount(paymentHistorySummary.disputedAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Records
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {paymentHistorySummary.total}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/40">
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Paid On
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Billing Period
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Method
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paymentHistoryItems.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-xs text-foreground">
                          {formatDate(p.paid_on)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-foreground">
                          {p.billing_start || p.billing_end ? (
                            <span className="whitespace-pre-line">
                              {p.billing_start ? formatDate(p.billing_start) : "—"}
                              {p.billing_start && p.billing_end ? " - " : ""}
                              {p.billing_end ? formatDate(p.billing_end) : ""}
                            </span>
                          ) : (
                            formatMonthLabel(p.month)
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-foreground">
                          {formatAmount(Number(p.amount))}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {p.method
                            ? (METHOD_LABEL[p.method as PaymentMethod] ?? p.method)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              p.status === "paid"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
                            )}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{p.receipt_number ?? "—"}</span>
                            {p.receipt_number ? (
                              <button
                                type="button"
                                onClick={() => printInvoice(p)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
                                title="Download invoice"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingInfoOpen} onOpenChange={setPendingInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rent Status Details</DialogTitle>
            <DialogDescription>
              {pendingInfoTenant?.full_name} billing status from rent start date.
            </DialogDescription>
          </DialogHeader>

          {pendingInfoDetail?.status === "paid" ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300">
              Fully paid till today.
              {pendingInfoDetail.coveredTill
                ? ` Covered till ${formatDate(pendingInfoDetail.coveredTill)}.`
                : ""}
            </div>
          ) : pendingInfoDetail ? (
            <div className="space-y-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3 text-sm text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p>
                    Pending Amount: {formatAmount(pendingInfoDetail.pendingAmount)}
                  </p>
                  <p>
                    Pending Period: {formatDate(pendingInfoDetail.pendingFrom)} -{" "}
                    {formatDate(pendingInfoDetail.pendingTo)}
                  </p>
                  {pendingInfoDetail.coveredTill ? (
                    <p>
                      Last Paid Till: {formatDate(pendingInfoDetail.coveredTill)}
                    </p>
                  ) : (
                    <p>No paid period found yet.</p>
                  )}
                </div>
              </div>

              {pendingInfoDetail.pendingBreakdown.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-md border border-orange-200/70 bg-background/70 dark:border-orange-500/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-orange-200/70 text-left dark:border-orange-500/30">
                        <th className="px-2 py-1.5">Month</th>
                        <th className="px-2 py-1.5">Dates</th>
                        <th className="px-2 py-1.5">Days</th>
                        <th className="px-2 py-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInfoDetail.pendingBreakdown.map((row) => (
                        <tr
                          key={`${row.start}-${row.end}`}
                          className="border-b border-orange-100/80 last:border-b-0 dark:border-orange-500/20"
                        >
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span>{row.monthLabel}</span>
                              {row.isPartial ? (
                                <span className="rounded-full border border-orange-300 px-1.5 py-0 text-[10px] leading-4 dark:border-orange-500/40">
                                  Partial
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            {formatDate(row.start)} - {formatDate(row.end)}
                          </td>
                          <td className="px-2 py-1.5">
                            {row.occupiedDays}/{row.daysInMonth}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {formatAmount(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
