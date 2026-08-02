export type TenantStatus = "pending" | "active" | "moved_out" | "rejected";

export type TenantSummary = {
  total: number;
  pending: number;
  active: number;
  moved_out: number;
  rejected: number;
};

export type HostelSummary = {
  id: string;
  name: string;
  location: string;
};

export type TenantSortOption =
  | "none"
  | "room_number"
  | "join_date"
  | "profile_completion"
  | "rent_amount";

export type PendingBreakdownItem = {
  monthLabel: string;
  start: string;
  end: string;
  occupiedDays: number;
  daysInMonth: number;
  amount: number;
  isPartial: boolean;
};

export type TenantPaymentCoverage = {
  status: "paid" | "pending";
  coveredTill: string | null;
  pendingFrom: string | null;
  pendingTo: string | null;
  pendingAmount: number;
  pendingBreakdown: PendingBreakdownItem[];
};

export type PaymentHistoryItem = {
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
