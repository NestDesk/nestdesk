import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIndianPhone } from "../../../../../lib/phone";
import { requestOwnerPhoneOtp } from "../../../../../lib/otp/service";

const requestSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
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
    const result = await requestOwnerPhoneOtp({
      phoneE164,
      purpose: "recover-account-phone",
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      devOtpHint: result.devOtpHint,
      reqId: result.reqId,
      message: "OTP sent to your phone.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send OTP. Please try again.",
      },
      { status: 400 },
    );
  }
}
