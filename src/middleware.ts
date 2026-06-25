import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveUserAccountRole, resolveUserRedirectPath } from "./lib/auth";
import { validateSupabaseEnv } from "./lib/supabase/env-check";
import { createAdminClient } from "./lib/supabase/admin";
import {
  getEffectivePlan,
  normalizeOwnerPlan,
  type SubscriptionRecord,
} from "./lib/subscriptions";

const COMPANY_ADMIN_EMAIL = "support@nestdesk.in";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/join",
  "/help",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
];

const PUBLIC_PREFIXES = ["/.well-known/", "/.well-known"];
// Paths that require guest state (redirect logged-in users away)
const AUTH_ONLY_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/tenant/register",
];

const FREE_PLAN_ALLOWED_PATHS = [
  "/dashboard",
  "/tenants",
  "/payments",
  "/subscriptions",
  "/hostels",
  "/profile",
  "/settings",
];

function isTenantRoute(pathname: string) {
  return pathname === "/tenant" || pathname.startsWith("/tenant/");
}

function isFreePlanAllowedPath(pathname: string) {
  return FREE_PLAN_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

function shouldBypassAuthCheck(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/join/") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/subscription-plans" ||
    pathname === "/api/tenant/register" ||
    pathname.startsWith("/api/tenant/phone-otp/") ||
    pathname.startsWith("/api/owner/phone-otp/")
  );
}

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/tenant/register") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/join/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/subscription-plans" ||
    pathname === "/api/tenant/register" ||
    pathname.startsWith("/api/tenant/phone-otp/") ||
    pathname.startsWith("/api/owner/phone-otp/") ||
    pathname === "/manifest.webmanifest" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function inferPreferredRole(pathname: string, redirectTo?: string | null) {
  if (isTenantRoute(pathname)) {
    return "tenant" as const;
  }

  if (redirectTo && isTenantRoute(redirectTo)) {
    return "tenant" as const;
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/subscriptions")
  ) {
    return "owner" as const;
  }

  return null;
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
    const requestedRedirectTo = request.nextUrl.searchParams.get("redirectTo");
    const safeRedirectTarget =
      requestedRedirectTo &&
      requestedRedirectTo.startsWith("/") &&
      !requestedRedirectTo.startsWith("//")
        ? requestedRedirectTo
        : null;

    const preferredRole = inferPreferredRole(pathname, safeRedirectTarget);
    const dest =
      safeRedirectTarget ??
      (await resolveUserRedirectPath(user.id, { preferredRole }));
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Company admin: redirect away from owner/tenant areas into /admin
  if (isLoggedIn && user.email === COMPANY_ADMIN_EMAIL) {
    if (
      pathname.startsWith("/dashboard") ||
      isTenantRoute(pathname) ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/subscriptions")
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // Non-admin: block access to /admin
  if (
    isLoggedIn &&
    user.email !== COMPANY_ADMIN_EMAIL &&
    pathname.startsWith("/admin")
  ) {
    const roleState = await resolveUserAccountRole(user.id);
    const fallbackPath = roleState.role === "tenant" ? "/tenant/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(fallbackPath, request.url));
  }

  if (isLoggedIn && user.email !== COMPANY_ADMIN_EMAIL) {
    const roleState = await resolveUserAccountRole(user.id);

    if (isTenantRoute(pathname) && roleState.role !== "tenant") {
      const fallbackPath = roleState.role === "owner" ? "/dashboard" : "/onboarding";
      return NextResponse.redirect(new URL(fallbackPath, request.url));
    }

    if (
      (pathname.startsWith("/dashboard") ||
        pathname.startsWith("/subscriptions") ||
        pathname === "/onboarding") &&
      roleState.role === "tenant"
    ) {
      return NextResponse.redirect(new URL("/tenant/dashboard", request.url));
    }
  }

  if (
    isLoggedIn &&
    user.email !== COMPANY_ADMIN_EMAIL &&
    (pathname.startsWith("/dashboard") || pathname === "/rent-reminders" || pathname.startsWith("/rent-reminders/")) &&
    !isFreePlanAllowedPath(pathname)
  ) {
    const admin = createAdminClient();
    const { data: owner } = await admin
      .from("owners")
      .select("id, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (owner) {
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("plan, status, ends_at")
        .eq("owner_id", owner.id)
        .in("status", ["active", "grace_period"])
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRecord>();

      const effectivePlan = getEffectivePlan(subscription ?? null);

      if (normalizeOwnerPlan(effectivePlan) === "free") {
        return NextResponse.redirect(new URL("/subscriptions", request.url));
      }
    }
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
