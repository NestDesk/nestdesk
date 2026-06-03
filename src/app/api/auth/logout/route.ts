import { NextRequest, NextResponse } from "next/server";
import { applySupabaseCookies, logoutFromSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { cookiesToSet } = await logoutFromSession(request);

  const response = NextResponse.redirect(new URL("/", request.url));

  applySupabaseCookies(response, cookiesToSet);

  return response;
}
