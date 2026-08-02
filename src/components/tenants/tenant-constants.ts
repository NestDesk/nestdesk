import type { TenantSortOption, TenantStatus } from "./tenant-types";
import type { PaymentMethod } from "../payments/RecordPaymentModal";

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

export const SORT_OPTION_LABELS: Record<TenantSortOption, string> = {
  none: "Sort by",
  room_number: "Room number",
  join_date: "Joined date",
  profile_completion: "Profile completion",
  rent_amount: "Rent amount",
};

export const STATUS_OPTIONS: Array<{
  value: TenantStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "moved_out", label: "Moved Out" },
  { value: "rejected", label: "Rejected" },
];
