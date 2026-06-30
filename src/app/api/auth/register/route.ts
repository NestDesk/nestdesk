import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  applySupabaseCookies,
  clearPendingEmailVerificationCookie,
  getPendingEmailVerification,
  isExistingUserError,
  registerWithEmailPassword,
  upsertAuthUserMetadata,
} from "../../../../lib/auth";

function buildValidationDetails(issues: z.ZodIssue[]) {
  return issues.map((issue) => ({
    field: issue.path.join(".") || "form",
    message: issue.message,
  }));
}

function buildSupabaseErrorDetails(message: string) {
  return [message];
}

const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters.")
    .max(100)
    .refine((value) => !/\d/.test(value), {
      message: "Name should not contain numbers.",
    }),
  consentGiven: z.boolean().refine((v) => v === true, {
    message: "You must agree to the Privacy Policy to continue.",
  }),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: buildValidationDetails(parsed.error.issues),
      },
      { status: 400 },
    );
  }

  const { email, password, fullName, consentGiven } = parsed.data;

  const verifiedEmail = getPendingEmailVerification(request);
  if (!verifiedEmail || verifiedEmail !== email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Please verify your email before creating an account." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const {
    data,
    error: createError,
    cookiesToSet,
  } = await registerWithEmailPassword(request, {
    email,
    password,
    metadata: { full_name: fullName, role: "owner" },
    emailConfirmRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
  });

  if (createError) {
    if (isExistingUserError(createError.message)) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists. Please sign in.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: createError.message || "Account creation failed.",
        details: buildSupabaseErrorDetails(createError.message),
      },
      { status: 400 },
    );
  }

  const authUserId = data.user?.id ?? data.session?.user?.id;
  if (!authUserId) {
    return NextResponse.json(
      { error: "Account creation failed. Please try again.", details: ["Missing user ID from Supabase sign-up response."] },
      { status: 500 },
    );
  }

  const { error: metadataError } = await upsertAuthUserMetadata(authUserId, {
    full_name: fullName,
    name: fullName,
    role: "owner",
  });

  if (metadataError) {
    return NextResponse.json(
      { error: metadataError.message || "Failed to save your profile name." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (consentGiven && authUserId) {
    await admin.from("consent_records").insert({
      user_id: authUserId,
      consent_type: "data_collection",
      consent_given: true,
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("cf-connecting-ip") ||
        undefined,
      form_version: "owner_registration_v1",
    });
  }

  const response = NextResponse.json({
    success: true,
    message:
      "Verification OTP has been sent to your email id. Check your inbox.",
  });

  applySupabaseCookies(response, cookiesToSet);
  clearPendingEmailVerificationCookie(response);

  return response;
}
