import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setPendingEmailVerificationCookie } from "../../../../../lib/auth";
import { verifyEmailOtp } from "../../../../../lib/otp/service";

const verifySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  otpCode: z.string().regex(/^[0-9]{4,8}$/, "Enter a valid OTP code."),
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
    await verifyEmailOtp({
      email: parsed.data.email,
      otpCode: parsed.data.otpCode,
    });

    const response = NextResponse.json({
      success: true,
      message: "Email verified successfully.",
    });

    setPendingEmailVerificationCookie(response, parsed.data.email);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to verify OTP. Please try again.",
      },
      { status: 400 },
    );
  }
}
