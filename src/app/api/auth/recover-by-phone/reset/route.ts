import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAuthUserByPhone, updateAuthUserPasswordAndOptionalEmail } from "../../../../../lib/auth";
import { verifyPhoneVerificationToken } from "../../../../../lib/otp/token";

const resetSchema = z
  .object({
    recoveryToken: z.string(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string(),
    newEmail: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  let payload;
  try {
    payload = verifyPhoneVerificationToken(parsed.data.recoveryToken);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid or expired recovery token.",
      },
      { status: 400 },
    );
  }

  if (payload.purpose !== "recover-account-phone") {
    return NextResponse.json(
      { error: "Invalid recovery token purpose." },
      { status: 400 },
    );
  }

  const match = await findAuthUserByPhone(payload.phoneE164);
  if (!match) {
    return NextResponse.json(
      { error: "No verified account is linked to this phone number." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { error } = await updateAuthUserPasswordAndOptionalEmail(
    request,
    match.userId,
    parsed.data.newPassword,
    {
      newEmail: parsed.data.newEmail?.trim() || undefined,
      emailConfirmRedirectTo: parsed.data.newEmail
        ? `${appUrl}/auth/callback?next=/login`
        : undefined,
    },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message:
      parsed.data.newEmail && parsed.data.newEmail.trim().length > 0
        ? "Password updated. A verification email has been sent to your new address."
        : "Password updated successfully. You can sign in with your new password.",
  });
}
