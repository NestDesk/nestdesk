import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { validateSupabaseEnv } from "./lib/supabase/env-check";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/join",
];
// Paths that require guest state (redirect logged-in users away)
const AUTH_ONLY_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/tenant/register",
];

function shouldBypassAuthCheck(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/join/") ||
    pathname === "/api/tenant/register"
  );
}

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/tenant/register") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/join/") ||
    pathname === "/api/tenant/register"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth lookup for static/HMR/auth API requests to reduce duplicate dev traffic.
  if (shouldBypassAuthCheck(pathname)) {
    return NextResponse.next({ request });
  }

  const { url, anonKey } = validateSupabaseEnv();

  // Build a mutable response so Supabase can refresh the session cookie inline.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: use getUser() not getSession() — validates JWT with Supabase server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;

  // Redirect authenticated users away from auth-only pages
  if (isLoggedIn && AUTH_ONLY_PATHS.includes(pathname)) {
    // /tenant/register → send to tenant portal; others → owner dashboard
    const dest = pathname.startsWith("/tenant/")
      ? "/tenant/dashboard"
      : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protect non-public routes
  if (!isLoggedIn && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
