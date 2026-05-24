import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

const SUCCESS_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
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

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      const lowerMessage = error.message.toLowerCase();

      if (
        lowerMessage.includes("rate limit") ||
        lowerMessage.includes("security purposes")
      ) {
        return NextResponse.json(
          { error: "Please wait a moment before requesting another reset email." },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Unable to send the reset email right now. Please try again shortly.",
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Authentication service is unreachable. Check NEXT_PUBLIC_SUPABASE_URL and your network.",
      },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ success: true, message: SUCCESS_MESSAGE });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });

  return response;
}
