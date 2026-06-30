import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAuthUserByEmail } from "../../../../../lib/auth";
import { requestEmailOtp } from "../../../../../lib/otp/service";

const requestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
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
    const existingUser = await findAuthUserByEmail(parsed.data.email);
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists. Please use a different email address.",
        },
        { status: 409 },
      );
    }

    const result = await requestEmailOtp({ email: parsed.data.email });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      devOtpHint: result.devOtpHint,
      message:
        result.mode === "msg91"
          ? "Verification email sent. Use the code in your inbox to verify."
          : "DEV mode OTP generated.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send verification email. Please try again.",
      },
      { status: 400 },
    );
  }
}
