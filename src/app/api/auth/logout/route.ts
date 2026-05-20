import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";

export async function POST(request: NextRequest) {
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

  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });

  // Clear session cookies by applying any cookie changes from signOut
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });

  return response;
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
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, password, fullName } = parsed.data;

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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Supabase sends verification email; user clicks link → /auth/callback
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
    },
  });

  if (error) {
    // Map Supabase error messages to safe user-facing messages
    if (error.message.toLowerCase().includes("already registered")) {
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }

  // ── 3. Build response (no session cookies yet — user must verify email) ──
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
