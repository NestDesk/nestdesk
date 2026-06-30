import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { normalizeIndianPhone } from "./phone";
import { validateSupabaseEnv } from "./supabase/env-check";
import { createAdminClient } from "./supabase/admin";

type SupabaseCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

type RegisterWithEmailPasswordInput = {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
  emailConfirmRedirectTo?: string;
};

const PENDING_EMAIL_VERIFICATION_COOKIE = "nestdesk_pending_email_verification";
const PENDING_EMAIL_VERIFICATION_TTL_SECONDS = 15 * 60;

export function getPendingEmailVerification(request: NextRequest) {
  const cookie = request.cookies.get(PENDING_EMAIL_VERIFICATION_COOKIE);
  if (!cookie?.value) {
    return null;
  }

  const [rawEmail, expiresAtValue] = cookie.value.split("|");
  if (!rawEmail || !expiresAtValue) {
    return null;
  }

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return decodeURIComponent(rawEmail).trim().toLowerCase();
}

export function setPendingEmailVerificationCookie(response: NextResponse, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + PENDING_EMAIL_VERIFICATION_TTL_SECONDS * 1000;

  response.cookies.set(PENDING_EMAIL_VERIFICATION_COOKIE, `${encodeURIComponent(normalizedEmail)}|${expiresAt}`, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_EMAIL_VERIFICATION_TTL_SECONDS,
  });
}

export function clearPendingEmailVerificationCookie(response: NextResponse) {
  response.cookies.set(PENDING_EMAIL_VERIFICATION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export type AccountRole = "owner" | "tenant" | "unknown";

type ResolveUserRedirectPathOptions = {
  preferredRole?: AccountRole | null;
};

function normalizeAccountRole(value: unknown): AccountRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "owner" || normalized === "tenant") {
    return normalized;
  }

  return null;
}

type ExchangeAuthInput = {
  code?: string;
  tokenHash?: string;
  otpType?: EmailOtpType | null;
};

async function resolveSignedUpUser(email: string, fallbackUser: { id?: string } | null | undefined) {
  if (fallbackUser?.id) {
    return fallbackUser;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });

  if (error || !data?.users?.length) {
    return fallbackUser ?? null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return (
    data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail) ??
    fallbackUser ??
    null
  );
}

function createRouteSupabaseClient(request: NextRequest) {
  const { url, anonKey } = validateSupabaseEnv();
  const cookiesToSet: SupabaseCookie[] = [];

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

  return { supabase, cookiesToSet };
}

export function applySupabaseCookies(
  response: NextResponse,
  cookiesToSet: SupabaseCookie[],
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });
}

export function isExistingUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  );
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw error;
  }

  return (
    data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail) ?? null
  );
}

export async function registerWithEmailPassword(
  request: NextRequest,
  input: RegisterWithEmailPasswordInput,
) {
  const { email, password, metadata, emailConfirmRedirectTo } = input;
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);

  try {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailConfirmRedirectTo,
        data: metadata,
      },
    });

    if (result.error) {
      return {
        data: { user: null, session: null },
        error: result.error,
        cookiesToSet,
      };
    }

    const resolvedUser = await resolveSignedUpUser(email, result.data.user);

    return {
      data: {
        ...result.data,
        user: resolvedUser,
      },
      error: null,
      cookiesToSet,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown sign-up error");
    return {
      data: { user: null, session: null },
      error: err,
      cookiesToSet,
    };
  }
}

export async function sendEmailOtp(
  request: NextRequest,
  email: string,
  emailConfirmRedirectTo: string,
) {
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);

  const result = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: emailConfirmRedirectTo,
      shouldCreateUser: false,
    },
  });

  return {
    data: result.data,
    error: result.error,
    cookiesToSet,
  };
}

export async function verifyEmailOtp(
  request: NextRequest,
  tokenHash: string,
) {
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);

  const result = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  return {
    data: result.data,
    error: result.error,
    cookiesToSet,
  };
}

export async function findAuthUserByPhone(phone: string) {
  const normalizedPhone = normalizeIndianPhone(phone);
  const tenDigitPhone = normalizedPhone.slice(-10);
  const admin = createAdminClient();

  const ownerResult = await admin
    .from("owners")
    .select("user_id")
    .eq("phone_verified", true)
    .in("phone", [normalizedPhone, tenDigitPhone])
    .maybeSingle();

  const tenantResult = await admin
    .from("tenants")
    .select("auth_user_id")
    .eq("phone_verified", true)
    .in("phone", [normalizedPhone, tenDigitPhone])
    .maybeSingle();

  if (ownerResult.error || tenantResult.error) {
    throw new Error(
      ownerResult.error?.message || tenantResult.error?.message ||
        "Unable to locate phone ownership.",
    );
  }

  const ownerMatch = ownerResult.data;
  const tenantMatch = tenantResult.data;

  if (ownerMatch && tenantMatch) {
    throw new Error(
      "Multiple accounts are associated with this phone number. Please contact support.",
    );
  }

  if (ownerMatch) {
    return { userId: ownerMatch.user_id, source: "owner" as const };
  }

  if (tenantMatch) {
    return { userId: tenantMatch.auth_user_id, source: "tenant" as const };
  }

  return null;
}

type UpdateUserPayload = {
  password: string;
  email?: string;
  email_confirm?: boolean;
  email_confirm_redirect_to?: string;
};

export async function updateAuthUserPasswordAndOptionalEmail(
  request: NextRequest,
  userId: string,
  newPassword: string,
  options?: {
    newEmail?: string;
    emailConfirmRedirectTo?: string;
  },
) {
  const admin = createAdminClient();
  const payload: UpdateUserPayload = {
    password: newPassword,
  };

  if (options?.newEmail) {
    payload.email = options.newEmail;
    payload.email_confirm = false;
    if (options.emailConfirmRedirectTo) {
      payload.email_confirm_redirect_to = options.emailConfirmRedirectTo;
    }
  }

  const result = await admin.auth.admin.updateUserById(userId, payload);
  if (result.error) {
    return { data: null, error: result.error };
  }

  if (options?.newEmail) {
    const email = options.newEmail.trim().toLowerCase();
    await admin.from("owners").update({ email }).eq("user_id", userId);
    await admin.from("tenants").update({ email }).eq("auth_user_id", userId);
  }

  return { data: result.data, error: null };
}

export async function upsertAuthUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const result = await admin.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });

  return { data: result.data, error: result.error };
}

export async function loginWithEmailPassword(
  request: NextRequest,
  email: string,
  password: string,
) {
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);
  const result = await supabase.auth.signInWithPassword({ email, password });

  return {
    data: result.data,
    error: result.error,
    cookiesToSet,
  };
}

export async function logoutFromSession(request: NextRequest) {
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);
  const result = await supabase.auth.signOut();

  return {
    error: result.error,
    cookiesToSet,
  };
}

export async function exchangeAuthForSession(
  request: NextRequest,
  input: ExchangeAuthInput,
) {
  const { supabase, cookiesToSet } = createRouteSupabaseClient(request);

  const result =
    input.tokenHash && input.otpType
      ? await supabase.auth.verifyOtp({
          token_hash: input.tokenHash,
          type: input.otpType,
        })
      : await supabase.auth.exchangeCodeForSession(input.code ?? "");

  return {
    data: result.data,
    error: result.error,
    cookiesToSet,
  };
}

export async function resolveUserAccountRole(userId: string) {
  const admin = createAdminClient();

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  if (userData?.user?.email === "support@nestdesk.in") {
    return {
      role: "owner" as const,
      redirectPath: "/admin",
    };
  }

  const metadataRole = normalizeAccountRole(
    userData?.user?.user_metadata?.role ?? userData?.user?.app_metadata?.role,
  );

  if (metadataRole === "tenant") {
    return {
      role: "tenant" as const,
      redirectPath: "/tenant/dashboard",
    };
  }

  if (metadataRole === "owner") {
    const { data: owner } = await admin
      .from("owners")
      .select("onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      role: "owner" as const,
      redirectPath: owner?.onboarding_completed ? "/dashboard" : "/onboarding",
    };
  }

  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (owner) {
    return {
      role: "owner" as const,
      redirectPath: owner.onboarding_completed ? "/dashboard" : "/onboarding",
    };
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (tenant) {
    return {
      role: "tenant" as const,
      redirectPath: "/tenant/dashboard",
    };
  }

  return {
    role: "unknown" as const,
    redirectPath: "/onboarding",
  };
}

export async function resolveUserRedirectPath(
  userId: string,
  options?: ResolveUserRedirectPathOptions,
) {
  const roleState = await resolveUserAccountRole(userId);

  if (options?.preferredRole === "tenant" && roleState.role === "tenant") {
    return "/tenant/dashboard";
  }

  if (options?.preferredRole === "owner" && roleState.role === "owner") {
    return roleState.redirectPath;
  }

  return roleState.redirectPath;
}
