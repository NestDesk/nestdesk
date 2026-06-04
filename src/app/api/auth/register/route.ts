import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applySupabaseCookies,
  isExistingUserError,
  registerWithEmailPassword,
} from "@/lib/auth";

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

  const {
    data,
    error: createError,
    cookiesToSet,
  } = await registerWithEmailPassword(request, {
    email,
    password,
    metadata: { full_name: fullName, role: "owner" },
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
        error: "Account creation failed.",
        details: buildSupabaseErrorDetails(createError.message),
      },
      { status: 400 },
    );
  }

  if (!data.user?.id) {
    return NextResponse.json(
      { error: "Account creation failed. Please try again." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  if (consentGiven && data.user.id) {
    await admin.from("consent_records").insert({
      user_id: data.user.id,
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
    redirectTo: "/onboarding",
    message: "Account created successfully.",
  });

  applySupabaseCookies(response, cookiesToSet);

  return response;
}
