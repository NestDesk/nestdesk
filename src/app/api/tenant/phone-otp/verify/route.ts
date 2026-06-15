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

export async function POST(request: NextRequest) {
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

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const phoneE164 = normalizeIndianPhone(parsed.data.phone);

    await verifyOwnerPhoneOtp({
      phoneE164,
      otpCode: parsed.data.otpCode,
      purpose: "verify-tenant-phone",
    });

    if (authError || !user) {
      return NextResponse.json({ success: true, verified: true });
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("tenants")
      .update({
        phone: parsed.data.phone,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OTP verification failed." },
      { status: 400 },
    );
  }
}
