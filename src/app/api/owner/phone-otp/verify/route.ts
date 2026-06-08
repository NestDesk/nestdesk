import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { createClient } from "../../../../../lib/supabase/server";
import { normalizeIndianPhone } from "../../../../../lib/phone";
import { verifyOwnerPhoneOtp } from "../../../../../lib/otp/service";

const verifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  otpCode: z.string().regex(/^\d{4,8}$/, "Enter a valid OTP code."),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
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

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizeIndianPhone(parsed.data.phone);
  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  try {
    await verifyOwnerPhoneOtp({
      phoneE164: normalizedPhone,
      otpCode: parsed.data.otpCode,
      purpose: "verify-owner-phone",
    });

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("owners")
      .update({
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
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
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: verifiedAt,
      },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OTP verification failed." },
      { status: 400 },
    );
  }
}
