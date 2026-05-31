import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";
import { createAdminClient } from "@/lib/supabase/admin";

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
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(100),
  consentGiven: z.boolean().refine((v) => v === true, {
    message: "You must agree to the Privacy Policy to continue.",
  }),
});

export async function POST(request: NextRequest) {
  // ── 1. Parse + validate ─────────────────────────────────────────────────
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  // Dev mode: do not rely on email delivery; create confirmed user directly.
  if (process.env.NODE_ENV !== "production") {
    const admin = createAdminClient();
    const { error: adminError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!adminError) {
      return NextResponse.json({
        success: true,
        requiresEmailVerification: false,
        message:
          "Dev mode: account created without email verification. You can sign in now.",
      });
    }

    if (adminError.message.toLowerCase().includes("already")) {
      return NextResponse.json(
        {
          success: true,
          message:
            "If that email is not registered, a confirmation link has been sent.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        error: "Account creation failed.",
        details: buildSupabaseErrorDetails(adminError.message),
      },
      { status: 400 },
    );
  }

  // ── 2. Create user via Supabase Auth ────────────────────────────────────
  const { url, anonKey } = validateSupabaseEnv();
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookiesToSet.push(...cookies);
      },
    },
  });

  // Store fullName in user_metadata so onboarding can pre-fill it
  let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
  let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"];
  try {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Supabase sends verification email; user clicks link → /auth/callback
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });
    data = result.data;
    error = result.error;
  } catch {
    return NextResponse.json(
      {
        error:
          "Authentication service is unreachable. Check NEXT_PUBLIC_SUPABASE_URL and your network.",
      },
      { status: 503 },
    );
  }

  if (error) {
    const lowerMsg = error.message.toLowerCase();

    // Development fallback: if Supabase email provider is throttled, bypass
    // verification mail and create a confirmed user so onboarding can proceed.
    if (process.env.NODE_ENV !== "production" && lowerMsg.includes("email")) {
      const admin = createAdminClient();
      const { error: adminError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (!adminError) {
        return NextResponse.json(
          {
            success: true,
            requiresEmailVerification: false,
            message:
              "Dev mode: account created without email verification. You can sign in now.",
          },
          { status: 200 },
        );
      }

      if (adminError.message.toLowerCase().includes("already")) {
        return NextResponse.json(
          {
            success: true,
            message:
              "If that email is not registered, a confirmation link has been sent.",
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          error: "Account creation failed.",
          details: buildSupabaseErrorDetails(adminError.message),
        },
        { status: 400 },
      );
    }

    // Map Supabase error messages to safe user-facing messages
    if (lowerMsg.includes("already registered")) {
      // Security: don't confirm email existence; return same message
      return NextResponse.json(
        {
          success: true,
          message:
            "If that email is not registered, a confirmation link has been sent.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        error: "Account creation failed.",
        details: buildSupabaseErrorDetails(error.message),
      },
      { status: 400 },
    );
  }

  if (!data.user) {
    // Supabase may intentionally return no user and no error in anti-enumeration flows.
    // Treat this as success and show the same verification message.
    return NextResponse.json({
      success: true,
      message: "If that email is not registered, a confirmation link has been sent.",
    });
  }

  // ── 3. Store consent record ─────────────────────────────────────────────
  if (consentGiven && data.user.id) {
    const admin = createAdminClient();
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

  // ── 4. Build response (no session cookies yet — user must verify email) ──
  const response = NextResponse.json({
    success: true,
    message:
      "Account created. Please check your email to verify your address before signing in.",
  });

  // If Supabase auto-confirms in dev mode (email confirmation disabled), set cookies
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });

  return response;
}
