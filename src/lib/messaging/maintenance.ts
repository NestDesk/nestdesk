import { createAdminClient } from "../supabase/admin";
import { normalizeIndianPhone } from "../phone";
import { sendNoticeWhatsApp } from "./whatsapp";

export interface NotifyMaintenanceOwnerInput {
  hostelId: string;
  roomId?: string | null;
  tenantId?: string | null;
  issueHeading: string;
  issueDescription?: string | null;
}

export async function notifyMaintenanceOwnerByWhatsApp(
  input: NotifyMaintenanceOwnerInput,
): Promise<{ sent: number; skipped: number }> {
  if (process.env.MSG91_ENABLED !== "true") {
    return { sent: 0, skipped: 0 };
  }

  const admin = createAdminClient();

  const [{ data: hostel, error: hostelError }, { data: tenant, error: tenantError }] =
    await Promise.all([
      admin
        .from("hostels")
        .select("id, name, owner_id")
        .eq("id", input.hostelId)
        .maybeSingle(),
      input.tenantId
        ? admin
            .from("tenants")
            .select("id, full_name, room_id")
            .eq("id", input.tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (hostelError) {
    throw new Error(hostelError.message);
  }

  if (tenantError) {
    throw new Error(tenantError.message);
  }

  if (!hostel?.owner_id) {
    return { sent: 0, skipped: 1 };
  }

  const [{ data: owner, error: ownerError }, { data: room, error: roomError }] =
    await Promise.all([
      admin
        .from("owners")
        .select("id, full_name, phone")
        .eq("id", hostel.owner_id)
        .maybeSingle(),
      input.roomId || tenant?.room_id
        ? admin
            .from("rooms")
            .select("id, room_number")
            .eq("id", input.roomId ?? tenant?.room_id ?? "")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (ownerError) {
    throw new Error(ownerError.message);
  }

  if (roomError) {
    throw new Error(roomError.message);
  }

  if (!owner?.phone) {
    return { sent: 0, skipped: 1 };
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeIndianPhone(owner.phone);
  } catch {
    return { sent: 0, skipped: 1 };
  }

  const ownerName = owner.full_name?.trim() || "Owner";
  const propertyName = hostel.name?.trim() || "Property";
  const roomNumber = room?.room_number?.trim() || "N/A";

  try {
    await sendNoticeWhatsApp({
      phoneE164: normalizedPhone,
      templateName: "maintenance_owner_notify",
      templateComponents: {
        body_1: {
          parameter_name: "owner_name",
          type: "text",
          value: ownerName,
        },
        body_2: {
          parameter_name: "property_name",
          type: "text",
          value: propertyName,
        },
        body_3: {
          parameter_name: "room_number",
          type: "text",
          value: roomNumber,
        },
        body_4: {
          parameter_name: "issue_heading",
          type: "text",
          value: input.issueHeading.trim(),
        },
        body_5: {
          parameter_name: "issue_description",
          type: "text",
          value: input.issueDescription?.trim() || "No additional details provided.",
        },
      },
    });

    return { sent: 1, skipped: 0 };
  } catch {
    return { sent: 0, skipped: 1 };
  }
}
