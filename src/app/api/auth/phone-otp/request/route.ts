import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIndianPhone } from "../../../../../lib/phone";
import { requestOwnerPhoneOtp } from "../../../../../lib/otp/service";
import { createAdminClient } from "../../../../../lib/supabase/admin";

const requestSchema = z.object({
  phone: z.string().min(10, "Enter a valid phone number."),
  purpose: z.literal("register-owner-phone"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const phoneE164 = normalizeIndianPhone(parsed.data.phone);
    const tenDigitPhone = phoneE164.slice(-10);
    const admin = createAdminClient();

    const [ownerMatch, tenantMatch] = await Promise.all([
      admin
        .from("owners")
        .select("id")
        .in("phone", [phoneE164, tenDigitPhone])
        .maybeSingle(),
      admin
        .from("tenants")
        .select("id")
        .in("phone", [phoneE164, tenDigitPhone])
        .maybeSingle(),
    ]);

    if (ownerMatch.error) {
      throw new Error(ownerMatch.error.message);
    }

    if (tenantMatch.error) {
      throw new Error(tenantMatch.error.message);
    }

    if (ownerMatch.data || tenantMatch.data) {
      return NextResponse.json(
        {
          error: "This mobile number is already registered. Please sign in or use another number.",
        },
        { status: 409 },
      );
    }

    const result = await requestOwnerPhoneOtp({
      phoneE164,
      purpose: parsed.data.purpose,
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      devOtpHint: result.devOtpHint,
      reqId: result.reqId,
      message:
        result.mode === "msg91"
          ? "OTP sent to your WhatsApp number."
          : "DEV mode OTP generated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send OTP." },
      { status: 400 },
    );
  }
}
