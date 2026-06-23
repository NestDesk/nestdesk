import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkLoginRateLimit, logLoginAttempt } from "../../../../lib/rate-limiter";
import {
  applySupabaseCookies,
  loginWithEmailPassword,
  resolveUserRedirectPath,
  type AccountRole,
} from "../../../../lib/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().optional(),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function isTenantRoute(pathname: string) {
  return pathname === "/tenant" || pathname.startsWith("/tenant/");
}

function inferPreferredRole(redirectTo?: string): AccountRole | null {
  if (!redirectTo || !redirectTo.startsWith("/")) {
    return null;
  }

  if (isTenantRoute(redirectTo)) {
    return "tenant";
  }

  if (
    redirectTo === "/dashboard" ||
    redirectTo.startsWith("/dashboard/") ||
    redirectTo === "/onboarding" ||
    redirectTo.startsWith("/subscriptions")
  ) {
    return "owner";
  }

  return null;
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

  const { email, password, redirectTo } = parsed.data;
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
  let data: Awaited<ReturnType<typeof loginWithEmailPassword>>["data"];
  let error: Awaited<ReturnType<typeof loginWithEmailPassword>>["error"];
  let cookiesToSet: Awaited<
    ReturnType<typeof loginWithEmailPassword>
  >["cookiesToSet"];

  try {
    const result = await loginWithEmailPassword(request, email, password);
    data = result.data;
    error = result.error;
    cookiesToSet = result.cookiesToSet;
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
  const resolvedRedirectTo = await resolveUserRedirectPath(data.user.id, {
    preferredRole: inferPreferredRole(redirectTo),
  });

  // ── 6. Build response and attach session cookies ─────────────────────────
  const response = NextResponse.json({ success: true, redirectTo: resolvedRedirectTo });
  applySupabaseCookies(response, cookiesToSet);

  return response;
}
