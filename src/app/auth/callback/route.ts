/**
 * /auth/callback
 *
 * Supabase redirects here after email verification and password recovery.
 * It exchanges the one-time auth payload for a live session and redirects the user.
 */
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  applySupabaseCookies,
  exchangeAuthForSession,
  resolveUserRedirectPath,
} from "../../../lib/auth";

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

  if (!code && !(tokenHash && otpType)) {
    return isRecoveryFlow
      ? buildErrorRedirect(origin, "/forgot-password", "invalid_or_expired_link")
      : buildErrorRedirect(origin, "/login", "missing_code");
  }

  const { data, error, cookiesToSet } = await exchangeAuthForSession(request, {
    code: code ?? undefined,
    tokenHash: tokenHash ?? undefined,
    otpType,
  });

  if (error || !data.session) {
    return isRecoveryFlow
      ? buildErrorRedirect(origin, "/forgot-password", "invalid_or_expired_link")
      : buildErrorRedirect(origin, "/login", "invalid_link");
  }

  if (isRecoveryFlow) {
    const recoveryResponse = NextResponse.redirect(
      `${origin}${RESET_PASSWORD_PATH}`,
    );

    applySupabaseCookies(recoveryResponse, cookiesToSet);

    return recoveryResponse;
  }

  const redirectPath =
    nextPath && nextPath !== RESET_PASSWORD_PATH
      ? nextPath
      : await resolveUserRedirectPath(data.session.user.id);

  const finalResponse = NextResponse.redirect(`${origin}${redirectPath}`);

  applySupabaseCookies(finalResponse, cookiesToSet);

  return finalResponse;
}
