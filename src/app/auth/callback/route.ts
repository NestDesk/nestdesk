/**
 * /auth/callback
 *
 * Supabase redirects here after email verification and password recovery.
 * It exchanges the one-time auth payload for a live session and redirects the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";
import { createAdminClient } from "@/lib/supabase/admin";

const RESET_PASSWORD_PATH = "/reset-password";

function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  return nextPath;
}

function buildErrorRedirect(origin: string, path: string, error: string) {
  const url = new URL(path, origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const isRecoveryFlow = otpType === "recovery" || nextPath === RESET_PASSWORD_PATH;

  if (!code && !(tokenHash && otpType === "recovery")) {
    return isRecoveryFlow
      ? buildErrorRedirect(origin, "/forgot-password", "invalid_or_expired_link")
      : buildErrorRedirect(origin, "/login", "missing_code");
  }

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

  const authResult =
    tokenHash && otpType === "recovery"
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
      : await supabase.auth.exchangeCodeForSession(code as string);

  const { data, error } = authResult;

  if (error || !data.session) {
    return isRecoveryFlow
      ? buildErrorRedirect(origin, "/forgot-password", "invalid_or_expired_link")
      : buildErrorRedirect(origin, "/login", "invalid_link");
  }

  if (isRecoveryFlow) {
    const recoveryResponse = NextResponse.redirect(
      `${origin}${RESET_PASSWORD_PATH}`,
    );

    cookiesToSet.forEach(({ name, value, options }) => {
      recoveryResponse.cookies.set(
        name,
        value,
        options as Parameters<typeof recoveryResponse.cookies.set>[2],
      );
    });

    return recoveryResponse;
  }

  // Check role to send user to the right place
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed")
    .eq("user_id", data.session.user.id)
    .maybeSingle();

  let redirectPath: string;
  if (owner) {
    redirectPath = owner.onboarding_completed ? "/dashboard" : "/onboarding";
  } else {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("auth_user_id", data.session.user.id)
      .maybeSingle();
    redirectPath = tenant ? "/tenant/dashboard" : "/onboarding";
  }
  const finalResponse = NextResponse.redirect(`${origin}${redirectPath}`);

  cookiesToSet.forEach(({ name, value, options }) => {
    finalResponse.cookies.set(
      name,
      value,
      options as Parameters<typeof finalResponse.cookies.set>[2],
    );
  });

  return finalResponse;
}
