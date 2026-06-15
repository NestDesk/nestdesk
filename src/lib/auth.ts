import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
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
};

type ExchangeAuthInput = {
  code?: string;
  tokenHash?: string;
  otpType?: EmailOtpType | null;
};

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

export async function registerWithEmailPassword(
  request: NextRequest,
  input: RegisterWithEmailPasswordInput,
) {
  const { email, password, metadata } = input;
  const admin = createAdminClient();

  const { data: createdUserData, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

  if (createUserError) {
    return {
      data: { user: null, session: null },
      error: createUserError,
      cookiesToSet: [] as SupabaseCookie[],
    };
  }

  if (!createdUserData.user?.id) {
    return {
      data: { user: null, session: null },
      error: new Error("Account creation failed. Please try again."),
      cookiesToSet: [] as SupabaseCookie[],
    };
  }

  const loginResult = await loginWithEmailPassword(request, email, password);

  if (loginResult.error || !loginResult.data.user) {
    await admin.auth.admin
      .deleteUser(createdUserData.user.id)
      .catch(() => undefined);

    return {
      data: loginResult.data,
      error:
        loginResult.error ??
        new Error("Account created, but sign-in failed. Please try again."),
      cookiesToSet: loginResult.cookiesToSet,
    };
  }

  return {
    data: loginResult.data,
    error: null,
    cookiesToSet: loginResult.cookiesToSet,
  };
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

export async function resolveUserRedirectPath(userId: string) {
  const admin = createAdminClient();

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  if (userData?.user?.email === "support@nestdesk.in") {
    return "/admin";
  }

  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (owner) {
    return owner.onboarding_completed ? "/dashboard" : "/onboarding";
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  return tenant ? "/tenant/dashboard" : "/onboarding";
}
