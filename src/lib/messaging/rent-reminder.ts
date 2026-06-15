import { createAdminClient } from "../supabase/admin";
import { normalizeIndianPhone } from "../phone";
import { sendNoticeWhatsApp } from "./whatsapp";

export interface SendRentReminderInput {
  tenantId: string;
  hostelId: string;
}

function formatDateForTemplate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toMonthKey(dateString: string): string {
  return dateString.slice(0, 7);
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
    .select("id, full_name, phone, hostel_id, agreed_rent_amount, rent_start_date, status")
    .eq("id", input.tenantId)
    .eq("hostel_id", input.hostelId)
    .eq("status", "active")
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
  if (reminderDate !== today) {
    return { sent: false, reason: "Not due day" };
  }

  const reminderMonth = toMonthKey(reminderDate);

  const { data: existing } = await admin
    .from("rent_reminder_logs")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("reminder_month", reminderMonth)
    .eq("template_name", "rent_reminder")
    .maybeSingle();

  if (existing) {
    return { sent: false, reason: "Already sent this month" };
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

  const startDate = latestPaid?.billing_end ?? tenant.rent_start_date;
  const endDate = latestPaid?.billing_end ?? tenant.rent_start_date;
  const amount = latestPaid?.amount ?? Number(tenant.agreed_rent_amount ?? 0);

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
        body_5: { parameter_name: "due_date", type: "text", value: reminderDate ? formatDateForTemplate(reminderDate) : "Today" },
        body_6: { parameter_name: "upi_id", type: "text", value: propertyBilling?.upi_id || "" },
        body_7: { parameter_name: "property_name", type: "text", value: hostel?.name || "Property" },
      },
    });

    await admin
      .from("rent_reminder_logs")
      .insert({
        tenant_id: tenant.id,
        hostel_id: tenant.hostel_id,
        reminder_month: reminderMonth,
        template_name: "rent_reminder",
        status: "sent",
      });

    return { sent: true };
  } catch (error) {
    await admin.from("rent_reminder_logs").insert({
      tenant_id: tenant.id,
      hostel_id: tenant.hostel_id,
      reminder_month: reminderMonth,
      template_name: "rent_reminder",
      status: "failed",
    });
    return { sent: false, reason: error instanceof Error ? error.message : "Send failed" };
  }
}
