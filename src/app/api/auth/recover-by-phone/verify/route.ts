import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIndianPhone } from "../../../../../lib/phone";
import { verifyOwnerPhoneOtp } from "../../../../../lib/otp/service";
import { createPhoneVerificationToken } from "../../../../../lib/otp/token";

const verifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  otpCode: z.string().regex(/^\d{4,8}$/, "Enter a valid OTP code."),
  reqId: z.string().optional(),
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
      reqId: parsed.data.reqId,
      purpose: "recover-account-phone",
    });

    const recoveryToken = createPhoneVerificationToken({
      phoneE164,
      purpose: "recover-account-phone",
      exp: Date.now() + 15 * 60 * 1000,
    });

    return NextResponse.json({
      success: true,
      recoveryToken,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OTP verification failed.",
      },
      { status: 400 },
    );
  }
}
