/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NestDesk Rent Billing Engine
 *
 * Single source of truth for ALL rent calculations.
 * Pure functions — no I/O, no side effects, no external dependencies.
 *
 * Core formula:
 *   perDayRent    = monthlyRent / daysInMonth        (month's actual calendar days)
 *   payableAmount = round(perDayRent × occupiedDays, 2 decimal places)
 *
 * All period boundaries are inclusive on both ends.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type InvoiceType =
  | "first_partial" // Tenant starts mid-month → rentStartDate to month-end
  | "full_month" // Standard cycle → 1st to last day
  | "final_partial" // Tenant moves out mid-month → 1st to moveOutDate
  | "custom"; // Owner-defined period

export interface RentCalculation {
  /** YYYY-MM-DD — inclusive start of billing period */
  billingStart: string;
  /** YYYY-MM-DD — inclusive end of billing period */
  billingEnd: string;
  /** Snapshot of agreed monthly rent at calculation time */
  monthlyRent: number;
  /** Total calendar days in the billing month (28 / 29 / 30 / 31) */
  daysInMonth: number;
  /** Days occupied, inclusive of both billingStart and billingEnd */
  occupiedDays: number;
  /** monthlyRent / daysInMonth — stored 4 dp for downstream accuracy */
  perDayRent: number;
  /** perDayRent × occupiedDays, rounded to exactly 2 decimal places */
  payableAmount: number;
  /** true when occupiedDays < daysInMonth */
  isProrated: boolean;
  invoiceType: InvoiceType;
}

export interface ScheduledInvoice {
  invoiceNumber: number;
  calculation: RentCalculation;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD string (or an existing Date) into a local midnight Date.
 * Avoids the UTC-offset bug that `new Date("YYYY-MM-DD")` introduces on many
 * environments (treats the string as UTC, not local time).
 */
function parseLocalDate(d: Date | string): Date {
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) throw new Error(`Cannot parse date: "${d}"`);
  return new Date(y, m - 1, day);
}

/** Format a local-midnight Date to YYYY-MM-DD. */
function toISO(d: Date): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the exact number of calendar days in a given month.
 * Handles leap years, February, 30-day and 31-day months correctly.
 *
 * @param year  Full year (e.g. 2026)
 * @param month 1-indexed (1 = January … 12 = December)
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of (month+1) = last day of month in JS Date arithmetic.
  return new Date(year, month, 0).getDate();
}

/**
 * Counts the number of days **inclusive** of both start and end.
 * Both arguments may be in the same or different months; the function
 * simply counts the span.
 */
export function getOccupiedDays(start: Date | string, end: Date | string): number {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/**
 * Core calculation function.
 *
 * Given a monthly rent amount and a billing period (both dates inclusive),
 * returns a complete RentCalculation snapshot.
 *
 * For accurate pro-ration the billing period must lie within a single
 * calendar month. For cross-month periods the start month's day-count is
 * used (callers should split by month for multi-month scenarios).
 *
 * @throws If monthlyRent is invalid, dates are invalid, or end < start.
 */
export function calculateRent(
  monthlyRent: number,
  billingStart: Date | string,
  billingEnd: Date | string,
  invoiceTypeOverride?: InvoiceType,
): RentCalculation {
  if (!isFinite(monthlyRent) || monthlyRent < 0) {
    throw new Error(`Invalid monthlyRent: ${monthlyRent}`);
  }

  const start = parseLocalDate(billingStart);
  const end = parseLocalDate(billingEnd);

  if (isNaN(start.getTime())) throw new Error("Invalid billingStart date");
  if (isNaN(end.getTime())) throw new Error("Invalid billingEnd date");
  if (end < start) throw new Error("billingEnd cannot be before billingStart");

  const year = start.getFullYear();
  const month = start.getMonth() + 1; // 1-indexed

  const daysInMonth = getDaysInMonth(year, month);
  const occupiedDays = getOccupiedDays(start, end);
  const perDayRent = monthlyRent / daysInMonth;
  const payableAmount = Math.round(perDayRent * occupiedDays * 100) / 100;
  const isProrated = occupiedDays < daysInMonth;

  const invoiceType: InvoiceType =
    invoiceTypeOverride ?? (isProrated ? "custom" : "full_month");

  return {
    billingStart: toISO(start),
    billingEnd: toISO(end),
    monthlyRent,
    daysInMonth,
    occupiedDays,
    perDayRent: Math.round(perDayRent * 10_000) / 10_000, // 4 dp
    payableAmount,
    isProrated,
    invoiceType,
  };
}

/**
 * Calculates the **first billing period** for a new tenant.
 *
 * - If `rentStartDate` is the 1st of the month → full month, no proration.
 * - Otherwise → rentStartDate to the last day of that month (pro-rated).
 */
export function getFirstBillingPeriod(
  rentStartDate: Date | string,
  monthlyRent: number,
): RentCalculation {
  const start = parseLocalDate(rentStartDate);
  const year = start.getFullYear();
  const month = start.getMonth() + 1; // 1-indexed
  const lastDay = getDaysInMonth(year, month);
  const end = new Date(year, month - 1, lastDay);
  const type: InvoiceType = start.getDate() === 1 ? "full_month" : "first_partial";
  return calculateRent(monthlyRent, start, end, type);
}

/**
 * Calculates a **full calendar month** billing period.
 * Always covers the 1st through the last day of the given month.
 *
 * @param year  Full year (e.g. 2026)
 * @param month 1-indexed month (1 = January … 12 = December)
 */
export function getFullMonthPeriod(
  year: number,
  month: number,
  monthlyRent: number,
): RentCalculation {
  const lastDay = getDaysInMonth(year, month);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1, lastDay);
  return calculateRent(monthlyRent, start, end, "full_month");
}

/**
 * Calculates the **final billing period** when a tenant moves out.
 *
 * - If `moveOutDate` is the last day of its month → full month, no proration.
 * - Otherwise → 1st of that month to moveOutDate (pro-rated).
 */
export function getFinalBillingPeriod(
  moveOutDate: Date | string,
  monthlyRent: number,
): RentCalculation {
  const end = parseLocalDate(moveOutDate);
  const year = end.getFullYear();
  const month = end.getMonth() + 1; // 1-indexed
  const lastDay = getDaysInMonth(year, month);
  const start = new Date(year, month - 1, 1);
  const type: InvoiceType =
    end.getDate() === lastDay ? "full_month" : "final_partial";
  return calculateRent(monthlyRent, start, end, type);
}

/**
 * Generates a complete billing schedule for a tenant from `rentStartDate`
 * forward.
 *
 * Cycle rules:
 *   - Cycle 1: pro-rated if mid-month start, else full month.
 *   - All subsequent cycles: full month (1st → last day).
 *   - Final cycle (if `moveOutDate` given): pro-rated to moveOutDate.
 *
 * @param rentStartDate  Date from which rent begins.
 * @param monthlyRent    Current agreed monthly rent amount.
 * @param moveOutDate    Optional tenant move-out date.
 * @param futureMonths   How many forward full months to generate when there
 *                       is no move-out date. Defaults to 3.
 */
export function generateInvoiceSchedule(
  rentStartDate: Date | string,
  monthlyRent: number,
  moveOutDate?: Date | string | null,
  futureMonths = 3,
): ScheduledInvoice[] {
  const start = parseLocalDate(rentStartDate);
  const moveOut = moveOutDate ? parseLocalDate(moveOutDate) : null;
  const entries: ScheduledInvoice[] = [];

  // Invoice 1 — first billing period
  entries.push({
    invoiceNumber: 1,
    calculation: getFirstBillingPeriod(start, monthlyRent),
  });

  let y = start.getFullYear();
  let m = start.getMonth() + 1; // 1-indexed

  const maxCycles = moveOut ? 600 : futureMonths; // 600 = 50-year safety cap

  for (let i = 0; i < maxCycles; i++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }

    if (moveOut) {
      const moY = moveOut.getFullYear();
      const moM = moveOut.getMonth() + 1;

      // Past the move-out month → stop
      if (y > moY || (y === moY && m > moM)) break;

      if (y === moY && m === moM) {
        // Final (possibly pro-rated) period
        entries.push({
          invoiceNumber: entries.length + 1,
          calculation: getFinalBillingPeriod(moveOut, monthlyRent),
        });
        break;
      }
    } else {
      // No move-out: generate `futureMonths` additional full months
      if (i >= futureMonths - 1) break;
    }

    entries.push({
      invoiceNumber: entries.length + 1,
      calculation: getFullMonthPeriod(y, m, monthlyRent),
    });
  }

  return entries;
}

/**
 * Formats a RentCalculation as a concise human-readable summary.
 *
 * Examples:
 *   "₹9,000 (Full month)"
 *   "₹5,226 (17/31 days × ₹307.42/day)"
 */
export function formatRentSummary(calc: RentCalculation): string {
  const fmtINR = (n: number, dp = 0) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: dp,
    }).format(n);

  if (!calc.isProrated) {
    return `${fmtINR(calc.payableAmount)} (Full month)`;
  }
  return (
    `${fmtINR(calc.payableAmount)} ` +
    `(${calc.occupiedDays}/${calc.daysInMonth} days × ` +
    `${fmtINR(calc.perDayRent, 2)}/day)`
  );
}
