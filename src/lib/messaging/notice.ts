import { createAdminClient } from "../supabase/admin";
import { normalizeIndianPhone } from "../phone";
import { sendNoticeWhatsApp } from "./whatsapp";

export interface BroadcastNoticeWhatsAppInput {
  hostelId: string;
  title: string;
  body: string;
  templateId?: string;
  templateName?: string;
}

function formatTemplateDate(dateString?: string): string {
  const date = dateString ? new Date(dateString) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function broadcastNoticeWhatsAppToActiveTenants(
  input: BroadcastNoticeWhatsAppInput,
): Promise<{ sent: number; skipped: number }> {
  if (process.env.MSG91_ENABLED !== "true") {
    return { sent: 0, skipped: 0 };
  }

  const admin = createAdminClient();
  const { data: hostel, error: hostelError } = await admin
    .from("hostels")
    .select("name")
    .eq("id", input.hostelId)
    .maybeSingle();

  if (hostelError) {
    throw new Error(hostelError.message);
  }

  const propertyName = hostel?.name?.trim() || "Property";

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, phone, full_name")
    .eq("hostel_id", input.hostelId)
    .eq("status", "active")
    .not("phone", "is", null)
    .neq("phone", "")
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = tenants ?? [];
  const results = await Promise.all(
    rows.map(async (tenant) => {
      if (!tenant.phone) {
        return { sent: 0, skipped: 1 };
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizeIndianPhone(tenant.phone);
      } catch {
        return { sent: 0, skipped: 1 };
      }

      const tenantName = tenant.full_name?.trim() || "Tenant";
      const today = formatTemplateDate();

      try {
        await sendNoticeWhatsApp({
          phoneE164: normalizedPhone,
          templateName: "notices",
          templateComponents: {
            body_1: {
              parameter_name: "tenant_name",
              type: "text",
              value: tenantName,
            },
            body_2: {
              parameter_name: "property_name",
              type: "text",
              value: propertyName,
            },
            body_3: {
              parameter_name: "actual_notice",
              type: "text",
              value: input.body.trim(),
            },
            body_4: {
              parameter_name: "date",
              type: "text",
              value: today,
            },
          },
        });

        return { sent: 1, skipped: 0 };
      } catch {
        return { sent: 0, skipped: 1 };
      }
    }),
  );

  const totals = results.reduce(
    (acc, result) => ({
      sent: acc.sent + result.sent,
      skipped: acc.skipped + result.skipped,
    }),
    { sent: 0, skipped: 0 },
  );

  return totals;
}
