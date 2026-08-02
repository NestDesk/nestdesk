import { formatDateInIndia } from "../../lib/date";

export function formatTenantDate(date: string | null) {
  return formatDateInIndia(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTenantAmount(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTenantMonth(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month) return monthStr;
  return formatDateInIndia(new Date(year, month - 1, 1), {
    month: "short",
    year: "numeric",
  });
}