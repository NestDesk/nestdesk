import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";
import { checkLoginRateLimit, logLoginAttempt } from "@/lib/rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  // ── 1. Parse + validate body ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email or password format." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // ── 2. Rate limit check ─────────────────────────────────────────────────
  const rateLimit = await checkLoginRateLimit(email, ip);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  // ── 3. Sign in via Supabase (server-side — sets httpOnly cookies) ────────
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

  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"];
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"];
  try {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
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

  // ── 4. Log the attempt (fire-and-forget, don't block response) ──────────
  logLoginAttempt({
    userId: data?.user?.id,
    email,
    ipAddress: ip,
    userAgent,
    success: !error,
    failureReason: error?.message,
  }).catch(() => {
    // Non-critical — never throw on logging failure
  });

  if (error || !data.user) {
    // Always use a generic message — never hint at whether email exists
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  // ── 5. Determine redirect based on user role ──────────────────────────────
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed")
    .eq("user_id", data.user.id)
    .maybeSingle();

  let redirectTo: string;
  if (owner) {
    redirectTo = owner.onboarding_completed ? "/dashboard" : "/onboarding";
  } else {
    // Check if this user is a registered tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    redirectTo = tenant ? "/tenant/dashboard" : "/onboarding";
  }

  // ── 6. Build response and attach session cookies ─────────────────────────
  const response = NextResponse.json({ success: true, redirectTo });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });

  return response;
}
