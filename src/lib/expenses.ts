export const EXPENSE_CATEGORIES = [
  "amenities",
  "electrical_repairs",
  "electricity_bills",
  "gas",
  "government_fees",
  "insurance",
  "internet",
  "mess_supplies",
  "maintenance_repairs",
  "miscellaneous",
  "painting",
  "pest_control",
  "plumbing",
  "carpenter",
  "property_tax",
  "repairs",
  "software_services",
  "staff_salary",
  "waste_management",
  "water",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function getExpenseCategoryLabel(category: string | null | undefined) {
  if (!category) return "Category";

  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const EXPENSE_STATUSES = ["paid", "pending", "disputed"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  disputed: "Disputed",
};

export const EXPENSE_PAYMENT_MODES = [
  "cash",
  "upi",
  "bank_transfer",
  "card",
  "other",
] as const;
export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number];

export const EXPENSE_PAYMENT_MODE_LABEL: Record<ExpensePaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

export const EXPENSE_RECURRING_FREQUENCIES = [
  "daily",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export type ExpenseRecurringFrequency =
  (typeof EXPENSE_RECURRING_FREQUENCIES)[number];
