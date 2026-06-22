import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";

const verifySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  otpCode: z.string().regex(/^[0-9]{4,8}$/, "Enter a valid OTP code."),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { email, otpCode } = parsed.data;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

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
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "signup",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      message: "Email verified successfully. Redirecting...",
      data,
    });

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 503 },
    );
  }
}
