import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const updateOwnerProfileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters.").max(100),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits."),
  addressLine1: z.string().min(5, "Address line 1 is too short.").max(200),
  addressLine2: z.string().max(150).optional().or(z.literal("")),
  landmark: z.string().max(100).optional().or(z.literal("")),
  city: z.string().min(2, "City is required.").max(100),
  state: z.string().min(2, "State is required.").max(100),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits."),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateOwnerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  const normalizedPhone = `+91${parsed.data.phone}`;
  const previousDigits = String(owner.phone ?? "")
    .replace(/\D/g, "")
    .slice(-10);
  const incomingDigits = normalizedPhone.replace(/\D/g, "").slice(-10);
  const phoneChanged = previousDigits !== incomingDigits;

  const payload = {
    full_name: parsed.data.fullName.trim(),
    phone: normalizedPhone,
    address_line1: parsed.data.addressLine1.trim(),
    address_line2: normalizeOptional(parsed.data.addressLine2),
    landmark: normalizeOptional(parsed.data.landmark),
    city: parsed.data.city.trim(),
    state: parsed.data.state.trim(),
    pincode: parsed.data.pincode,
    ...(phoneChanged ? { phone_verified: false, phone_verified_at: null } : {}),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await admin
    .from("owners")
    .update(payload)
    .eq("id", owner.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: owner.id,
    user_id: user.id,
    action: "UPDATE",
    table_name: "owners",
    record_id: owner.id,
    new_value: {
      full_name: payload.full_name,
      phone: payload.phone,
      address_line1: payload.address_line1,
      address_line2: payload.address_line2,
      landmark: payload.landmark,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
    },
    ip_address: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
