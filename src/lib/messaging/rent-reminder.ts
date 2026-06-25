import { calculateRent } from "../billing";
import { createAdminClient } from "../supabase/admin";
import { normalizeIndianPhone } from "../phone";
import { sendNoticeWhatsApp } from "./whatsapp";

export interface SendRentReminderInput {
  tenantId: string;
  hostelId: string;
  skipDueDateCheck?: boolean;
}

export const MAX_REMINDERS_PER_MONTH = 3;
export const REMINDER_COOLDOWN_HOURS = 24;

export function getCurrentReminderMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatDateForTemplate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateString: string, days: number): string {
  const date = parseISODate(dateString);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function getMonthEndDate(dateString: string): string {
  const [year, month] = dateString.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return toISODate(new Date(year, month - 1, lastDay));
}

function getReminderDueDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const currentDate = new Date(year, month - 1, day);

  if (currentDate.getDate() <= 5) {
    return toISODate(new Date(year, month - 1, 5));
  }

  return dateString;
}

function calculatePendingCoverage(monthlyRent: number, pendingFrom: string, pendingTo: string) {
  let cursor = parseISODate(pendingFrom);
  const end = parseISODate(pendingTo);
  let totalAmount = 0;

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const monthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
    const periodEnd = monthEnd < end ? monthEnd : end;

    const calc = calculateRent(monthlyRent, toISODate(periodStart), toISODate(periodEnd));
    totalAmount += calc.payableAmount;

    cursor = new Date(periodEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    startDate: pendingFrom,
    endDate: pendingTo,
    amount: Math.round(totalAmount * 100) / 100,
  };
}

function calculateReminderPeriod(input: {
  monthlyRent: number;
  pendingFrom: string | null;
  currentDate: string;
  tenantStatus: string;
  moveOutDate: string | null;
  useBillingPeriod: boolean;
}) {
  const effectiveEnd = input.tenantStatus === "moved_out" && input.moveOutDate
    ? input.moveOutDate
    : input.currentDate;

  if (!input.pendingFrom || input.pendingFrom > effectiveEnd) {
    return { startDate: null, endDate: null, amount: 0 };
  }

  if (!input.useBillingPeriod) {
    return calculatePendingCoverage(input.monthlyRent, input.pendingFrom, effectiveEnd);
  }

  const currentMonthEnd = getMonthEndDate(input.currentDate);
  const billingPeriodEnd = input.pendingFrom <= currentMonthEnd
    ? (input.tenantStatus === "moved_out" && input.moveOutDate
      ? (input.moveOutDate < currentMonthEnd ? input.moveOutDate : currentMonthEnd)
      : currentMonthEnd)
    : null;

  if (!billingPeriodEnd) {
    return { startDate: input.pendingFrom, endDate: null, amount: 0 };
  }

  return calculatePendingCoverage(input.monthlyRent, input.pendingFrom, billingPeriodEnd);
}

async function getReminderLogs(admin: ReturnType<typeof createAdminClient>, tenantId: string, reminderMonth: string) {
  const baseQuery = admin
    .from("rent_reminder_logs")
    .select("id, attempt_count, sent_at")
    .eq("tenant_id", tenantId)
    .eq("reminder_month", reminderMonth)
    .eq("template_name", "rent_reminder")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  const { data, error } = await baseQuery;
  if (!error) {
    return { data: (data ?? []).map((entry) => ({ ...entry, attempt_count: Number(entry.attempt_count ?? 1) })), error: null };
  }

  const fallbackMessage = error.message?.toLowerCase() ?? "";
  if (fallbackMessage.includes("attempt_count") || fallbackMessage.includes("does not exist")) {
    const fallback = await admin
      .from("rent_reminder_logs")
      .select("id, sent_at")
      .eq("tenant_id", tenantId)
      .eq("reminder_month", reminderMonth)
      .eq("template_name", "rent_reminder")
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    return {
      data: (fallback.data ?? []).map((entry) => ({ id: entry.id, attempt_count: 1, sent_at: entry.sent_at })),
      error: fallback.error,
    };
  }

  return { data: [], error };
}

async function insertReminderLog(admin: ReturnType<typeof createAdminClient>, payload: Record<string, unknown>) {
  const { error } = await admin.from("rent_reminder_logs").insert(payload);
  if (!error) {
    return;
  }

  const fallbackMessage = error.message?.toLowerCase() ?? "";
  if (fallbackMessage.includes("attempt_count") || fallbackMessage.includes("does not exist")) {
    const fallbackPayload = { ...payload } as Record<string, unknown>;
    delete fallbackPayload.attempt_count;
    const { error: fallbackError } = await admin.from("rent_reminder_logs").insert(fallbackPayload);
    if (fallbackError) {
      throw fallbackError;
    }
    return;
  }

  throw error;
}

export async function sendRentReminderForTenant(
  input: SendRentReminderInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (process.env.MSG91_ENABLED !== "true") {
    return { sent: false, reason: "MSG91 disabled" };
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, full_name, phone, hostel_id, agreed_rent_amount, rent_start_date, status, move_out_date")
    .eq("id", input.tenantId)
    .eq("hostel_id", input.hostelId)
    .in("status", ["active", "moved_out"])
    .maybeSingle();

  if (tenantError || !tenant) {
    return { sent: false, reason: "Tenant not found" };
  }

  if (!tenant.phone) {
    return { sent: false, reason: "No phone number" };
  }

  const { data: latestPaid } = await admin
    .from("payments")
    .select("billing_end, amount, month")
    .eq("tenant_id", tenant.id)
    .eq("status", "paid")
    .not("billing_end", "is", null)
    .order("billing_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reminderDate = latestPaid?.billing_end
    ? (() => {
        const [y, m, d] = latestPaid.billing_end.split("-").map(Number);
        const next = new Date(y, m - 1, d + 1);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      })()
    : tenant.rent_start_date;

  const today = new Date().toISOString().slice(0, 10);
  if (!input.skipDueDateCheck && reminderDate !== today) {
    return { sent: false, reason: "Not due day" };
  }

  const pendingFrom = latestPaid?.billing_end ? addDays(latestPaid.billing_end, 1) : tenant.rent_start_date;
  const billingPeriod = calculateReminderPeriod({
    monthlyRent: Number(tenant.agreed_rent_amount ?? 0),
    pendingFrom,
    currentDate: today,
    tenantStatus: tenant.status,
    moveOutDate: tenant.move_out_date,
    useBillingPeriod: Boolean(input.skipDueDateCheck),
  });

  if (!billingPeriod.startDate || billingPeriod.amount <= 0) {
    return { sent: false, reason: "No pending rent" };
  }

  const reminderMonth = getCurrentReminderMonthKey();

  const { data: reminderLogs, error: reminderLogsError } = await getReminderLogs(admin, tenant.id, reminderMonth);

  if (reminderLogsError) {
    return { sent: false, reason: reminderLogsError.message };
  }

  const currentAttemptCount = (reminderLogs ?? []).reduce(
    (totalCount, entry) => totalCount + Number(entry.attempt_count ?? 1),
    0,
  );

  const latestSentAt = reminderLogs?.[0]?.sent_at;
  const now = new Date();
  const cooldownActive = latestSentAt
    ? now.getTime() - new Date(latestSentAt).getTime() < REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000
    : false;

  if (currentAttemptCount >= MAX_REMINDERS_PER_MONTH) {
    return { sent: false, reason: "Monthly reminder limit reached" };
  }

  if (cooldownActive) {
    return { sent: false, reason: "Reminder cooldown active" };
  }

  const { data: hostel } = await admin
    .from("hostels")
    .select("name")
    .eq("id", tenant.hostel_id)
    .maybeSingle();

  const { data: propertyBilling } = await admin
    .from("property_billing")
    .select("upi_id")
    .eq("hostel_id", tenant.hostel_id)
    .maybeSingle();

  const startDate = billingPeriod.startDate;
  const endDate = billingPeriod.endDate;
  const amount = billingPeriod.amount;
  const dueDate = getReminderDueDate(today);

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeIndianPhone(tenant.phone);
  } catch {
    return { sent: false, reason: "Invalid phone number" };
  }

  try {
    await sendNoticeWhatsApp({
      phoneE164: normalizedPhone,
      templateName: "rent_reminder",
      templateComponents: {
        body_1: { parameter_name: "tenant_name", type: "text", value: tenant.full_name || "Tenant" },
        body_2: { parameter_name: "start_date", type: "text", value: startDate ? formatDateForTemplate(startDate) : "Today" },
        body_3: { parameter_name: "end_date", type: "text", value: endDate ? formatDateForTemplate(endDate) : "Today" },
        body_4: { parameter_name: "rent_amount", type: "text", value: String(amount) },
        body_5: { parameter_name: "due_date", type: "text", value: formatDateForTemplate(dueDate) },
        body_6: { parameter_name: "upi_id", type: "text", value: propertyBilling?.upi_id || "" },
        body_7: { parameter_name: "property_name", type: "text", value: hostel?.name || "Property" },
      },
    });

    await insertReminderLog(admin, {
      tenant_id: tenant.id,
      hostel_id: tenant.hostel_id,
      reminder_month: reminderMonth,
      template_name: "rent_reminder",
      status: "sent",
      attempt_count: currentAttemptCount + 1,
    });

    return { sent: true };
  } catch (error) {
    await insertReminderLog(admin, {
      tenant_id: tenant.id,
      hostel_id: tenant.hostel_id,
      reminder_month: reminderMonth,
      template_name: "rent_reminder",
      status: "failed",
      attempt_count: currentAttemptCount + 1,
    });
    return { sent: false, reason: error instanceof Error ? error.message : "Send failed" };
  }
}
