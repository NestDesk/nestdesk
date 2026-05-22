/**
 * /auth/callback
 *
 * Supabase redirects here after email verification (and password resets in future).
 * Exchanges the one-time `code` query param for a live session and redirects the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  // Check onboarding status to send user to the right place
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed")
    .eq("user_id", data.session.user.id)
    .maybeSingle();

  const redirectPath = owner?.onboarding_completed ? "/dashboard" : "/onboarding";
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
