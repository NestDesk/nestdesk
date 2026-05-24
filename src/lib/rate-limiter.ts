/**
 * DB-backed rate limiter for login attempts.
 * Works in serverless (Vercel) because state lives in Supabase, not in-process memory.
 *
 * Rules: 5 failed attempts per email within 15 minutes → locked out for 15 minutes.
 * IP is also checked independently (extra brute-force layer).
 */

import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait before retrying. 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * Check rate limit for a given email (and optionally IP).
 * Returns whether the request is allowed and retry metadata.
 */
export async function checkLoginRateLimit(
  email: string,
  ip: string,
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const windowStart = new Date(
    Date.now() - WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  // Count recent failures for this email OR ip
  const { count, error } = await admin
    .from("login_activity")
    .select("*", { count: "exact", head: true })
    .eq("success", false)
    .or(`email.eq.${email},ip_address.eq.${ip}`)
    .gte("created_at", windowStart);

  if (error || count === null) {
    // On DB error, fail open (don't block the user)
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (count >= MAX_ATTEMPTS) {
    // Find when the oldest blocking attempt will expire
    const { data: oldest } = await admin
      .from("login_activity")
      .select("created_at")
      .eq("success", false)
      .or(`email.eq.${email},ip_address.eq.${ip}`)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (oldest) {
      const unlockAt =
        new Date(oldest.created_at).getTime() + WINDOW_MINUTES * 60 * 1000;
      const retryAfterSeconds = Math.ceil((unlockAt - Date.now()) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(0, retryAfterSeconds),
      };
    }

    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Log a login attempt (success or failure) to the DB.
 * Uses the admin/service-role client to bypass RLS so this always writes.
 */
export async function logLoginAttempt(params: {
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
}): Promise<void> {
  const admin = createAdminClient();

  await admin.from("login_activity").insert({
    user_id: params.userId ?? null,
    email: params.email,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    success: params.success,
    failure_reason: params.failureReason ?? null,
  });
}
