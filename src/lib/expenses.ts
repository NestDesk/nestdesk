export const EXPENSE_CATEGORIES = [
  "electricity",
  "water",
  "gas",
  "internet",
  "staff_salary",
  "security_services",
  "housekeeping_cleaning",
  "maintenance_repair",
  "plumbing",
  "electrical_repairs",
  "pest_control",
  "laundry_linen",
  "kitchen_supplies",
  "property_supplies",
  "property_tax",
  "government_fees",
  "insurance",
  "software_saas",
  "marketing",
  "transportation",
  "legal_professional",
  "waste_management",
  "amenities",
  "miscellaneous",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  electricity: "Electricity",
  water: "Water",
  gas: "Gas",
  internet: "Internet",
  staff_salary: "Staff Salary",
  security_services: "Security Services",
  housekeeping_cleaning: "Housekeeping & Cleaning",
  maintenance_repair: "Maintenance & Repairs",
  plumbing: "Plumbing",
  electrical_repairs: "Electrical Repairs",
  pest_control: "Pest Control",
  laundry_linen: "Laundry & Linen",
  kitchen_supplies: "Kitchen Supplies",
  property_supplies: "Property Supplies",
  property_tax: "Property Tax",
  government_fees: "Government Fees",
  insurance: "Insurance",
  software_saas: "Software / SaaS",
  marketing: "Marketing",
  transportation: "Transportation",
  legal_professional: "Legal & Professional",
  waste_management: "Waste Management",
  amenities: "Amenities",
  miscellaneous: "Miscellaneous",
};

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
