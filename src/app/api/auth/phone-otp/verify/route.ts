import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIndianPhone } from "../../../../../lib/phone";
import { verifyOwnerPhoneOtp } from "../../../../../lib/otp/service";
import { createPhoneVerificationToken } from "../../../../../lib/otp/token";

const verifySchema = z.object({
  phone: z.string().min(10, "Enter a valid phone number."),
  otpCode: z.string().regex(/^\d{4,8}$/, "Enter a valid OTP code."),
  purpose: z.literal("register-owner-phone"),
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
    const phoneE164 = normalizeIndianPhone(parsed.data.phone);

    await verifyOwnerPhoneOtp({
      phoneE164,
      otpCode: parsed.data.otpCode,
      purpose: parsed.data.purpose,
    });

    const phoneVerificationToken = createPhoneVerificationToken({
      phoneE164,
      purpose: parsed.data.purpose,
      exp: Date.now() + 15 * 60 * 1000,
    });

    return NextResponse.json({
      success: true,
      phoneVerificationToken,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OTP verification failed." },
      { status: 400 },
    );
  }
}
