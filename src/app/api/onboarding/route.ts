import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  // Owner details
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(150).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  ownerPincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  // First hostel details
  hostelName: z.string().min(2).max(200),
  propertyType: z.enum(["pg", "hostel", "coliving", "rental"]),
  address: z.string().min(5).max(300),
  hostelCity: z.string().min(2).max(100),
  hostelState: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  totalRooms: z.number().int().min(1).max(9999),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function isMissingColumnError(message?: string, column?: string): boolean {
  if (!message || !column) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find") && lower.includes(`'${column.toLowerCase()}'`)
  );
}

function isOwnersIdForeignKeyError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("owners_id_fkey") ||
    (lower.includes("violates foreign key constraint") &&
      lower.includes('table "owners"'))
  );
}

function getMissingColumnName(message?: string): string | null {
  if (!message) return null;
  const match = message.match(/could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

function getUserPhone(user: {
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const directPhone = user.phone;
  if (typeof directPhone === "string" && directPhone.trim().length > 0) {
    return directPhone.trim();
  }

  const metaPhone = user.user_metadata?.phone;
  if (typeof metaPhone === "string" && metaPhone.trim().length > 0) {
    return metaPhone.trim();
  }

  return null;
}

function getUserFullName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const metaFullName = user.user_metadata?.full_name;
  if (typeof metaFullName === "string" && metaFullName.trim().length >= 2) {
    return metaFullName.trim();
  }
  return null;
}

export async function POST(request: NextRequest) {
  // ── 1. Verify authenticated session ────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse + validate body ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data = parsed.data;
  const ip = getClientIp(request);
  const admin = createAdminClient();
  const authUserResult = await admin.auth.admin.getUserById(user.id);
  const authUser = authUserResult.data.user;

  const authEmail =
    user.email?.trim().toLowerCase() ??
    authUser?.email?.trim().toLowerCase() ??
    null;

  const phoneFromAuth = authUser
    ? getUserPhone(authUser)
    : getUserPhone({
        phone: user.phone,
        user_metadata: user.user_metadata,
      });

  const inputDigits = String(data.phone ?? "")
    .replace(/\D/g, "")
    .slice(0, 10);
  const authDigits = String(phoneFromAuth ?? "")
    .replace(/\D/g, "")
    .slice(-10);
  const normalizedPhone = `+91${inputDigits || authDigits}`;

  if (!authEmail) {
    return NextResponse.json(
      { error: "Authenticated user email is missing." },
      { status: 400 },
    );
  }

  // ── 3. Check if owner already onboarded (idempotency guard) ────────────
  const existingByUserId = await admin
    .from("owners")
    .select("id, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingByUserId.error) {
    return NextResponse.json(
      { error: existingByUserId.error.message },
      { status: 500 },
    );
  }

  const existing = existingByUserId.data;

  if (existing?.onboarding_completed) {
    return NextResponse.json(
      { error: "Onboarding already completed." },
      { status: 409 },
    );
  }

  // ── 4. Save owner profile ───────────────────────────────────────────────
  let owner: {
    id: string;
  } | null = null;
  let ownerError: { message: string } | null = null;

  const ownerPayloadBase = {
    user_id: user.id,
    full_name:
      data.fullName.trim() ||
      getUserFullName(user) ||
      (authUser ? getUserFullName(authUser) : null) ||
      "Owner",
    email: authEmail,
    phone: normalizedPhone,
    address_line1: data.addressLine1,
    address_line2: data.addressLine2?.trim() || null,
    landmark: data.landmark?.trim() || null,
    city: data.city,
    state: data.state,
    pincode: data.ownerPincode,
    plan: "free",
    kyc_address_verified: false,
    onboarding_completed: false,
  };
  const ownerPayload = ownerPayloadBase;

  if (existing?.id) {
    let updatePayload: Record<string, unknown> = { ...ownerPayload };
    while (true) {
      const updateOwner = await admin
        .from("owners")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id")
        .single();

      if (!updateOwner.error) {
        owner = updateOwner.data;
        ownerError = null;
        break;
      }

      const missingColumn = getMissingColumnName(updateOwner.error.message);
      if (missingColumn && missingColumn in updatePayload) {
        const { [missingColumn]: _removed, ...nextPayload } = updatePayload;
        updatePayload = nextPayload;
        continue;
      }

      // Compatibility shim for environments where email isn't present.
      if (isMissingColumnError(updateOwner.error.message, "email")) {
        const { email: _email, ...legacyOwnerPayload } = updatePayload;
        updatePayload = legacyOwnerPayload;
        continue;
      }

      owner = null;
      ownerError = { message: updateOwner.error.message };
      break;
    }
  } else {
    let insertPayload: Record<string, unknown> = { ...ownerPayload };
    let insertId = crypto.randomUUID();

    while (true) {
      const insertOwner = await admin
        .from("owners")
        .upsert({ id: insertId, ...insertPayload }, { onConflict: "user_id" })
        .select("id")
        .single();

      if (!insertOwner.error) {
        owner = insertOwner.data;
        ownerError = null;
        break;
      }

      if (
        isOwnersIdForeignKeyError(insertOwner.error.message) &&
        insertId !== user.id
      ) {
        insertId = user.id;
        continue;
      }

      const missingColumn = getMissingColumnName(insertOwner.error.message);
      if (missingColumn && missingColumn in insertPayload) {
        const { [missingColumn]: _removed, ...nextPayload } = insertPayload;
        insertPayload = nextPayload;
        continue;
      }

      // Compatibility shim for environments where email isn't present.
      if (isMissingColumnError(insertOwner.error.message, "email")) {
        const { email: _email, ...legacyOwnerPayload } = insertPayload;
        insertPayload = legacyOwnerPayload;
        continue;
      }

      owner = null;
      ownerError = { message: insertOwner.error.message };
      break;
    }
  }

  if (ownerError || !owner) {
    return NextResponse.json(
      {
        error: ownerError?.message ?? "Failed to save owner profile.",
      },
      { status: 500 },
    );
  }

  // ── 5. Create first hostel ──────────────────────────────────────────────
  const { error: hostelError } = await admin.from("hostels").insert({
    owner_id: owner.id,
    name: data.hostelName,
    property_type: data.propertyType,
    address: data.address,
    city: data.hostelCity,
    state: data.hostelState,
    pincode: data.pincode,
    total_rooms: data.totalRooms,
  });

  if (hostelError) {
    // Only rollback owner when this request created it.
    if (!existing?.id) {
      await admin.from("owners").delete().eq("id", owner.id);
    }
    return NextResponse.json(
      { error: "Failed to save property details." },
      { status: 500 },
    );
  }

  // ── 6. Mark onboarding complete ─────────────────────────────────────────
  await admin
    .from("owners")
    .update({ onboarding_completed: true })
    .eq("id", owner.id);

  // ── 7. Write audit log ──────────────────────────────────────────────────
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "CREATE",
    table_name: "owners",
    record_id: owner.id,
    new_value: {
      full_name: data.fullName,
      phone: normalizedPhone,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2?.trim() || null,
      landmark: data.landmark?.trim() || null,
      city: data.city,
      state: data.state,
      pincode: data.ownerPincode,
    },
    ip_address: ip,
  });

  return NextResponse.json({ success: true, redirectTo: "/dashboard" });
}
