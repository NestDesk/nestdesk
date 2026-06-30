import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { validateSupabaseEnv } from "../../../../lib/supabase/env-check";
import {
  applySupabaseCookies,
  clearPendingEmailVerificationCookie,
  getPendingEmailVerification,
  isExistingUserError,
  loginWithEmailPassword,
  registerWithEmailPassword,
  updateAuthUserPasswordAndOptionalEmail,
  upsertAuthUserMetadata,
} from "../../../../lib/auth";
import { normalizeIndianPhone } from "../../../../lib/phone";
import {
  isValidAadhaarNumber,
  normalizeAadhaarNumber,
} from "../../../../lib/aadhaar";
import { encryptAadhaar, hashAadhaar } from "../../../../lib/aadhaar-encryption";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

const bodySchema = z.object({
  token: z.string().min(1).max(64),
  hostelId: z.string().uuid("Invalid hostel ID."),
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(100),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit phone number.")
    .optional()
    .or(z.literal("")),
  phoneVerified: z.boolean().optional().default(false),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  occupationType: z.enum(["student", "working_professional", "business", "other"], {
    message: "Select a valid occupation type.",
  }),
  institutionName: z
    .string()
    .min(2, "Institution name must be at least 2 characters.")
    .max(120),
  gender: z.enum(["male", "female", "rather_not_say"], {
    message: "Select a valid gender option.",
  }),
  aadharNumber: z
    .string()
    .regex(/^\d{12}$/, "Enter a valid 12-digit Aadhaar number.")
    .optional()
    .or(z.literal("")),
  consentGiven: z.boolean().refine((v) => v === true, {
    message: "You must agree to the privacy policy to continue.",
  }),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join(".") || "form",
      message: i.message,
    }));
    return NextResponse.json(
      { error: details[0]?.message ?? "Validation failed.", details },
      { status: 400 },
    );
  }

  const {
    token,
    hostelId,
    fullName,
    email,
    phone,
    phoneVerified,
    password,
    occupationType,
    institutionName,
    gender,
    aadharNumber,
    consentGiven,
  } = parsed.data;

  const normalizedAadhaar = aadharNumber
    ? normalizeAadhaarNumber(aadharNumber)
    : null;
  if (normalizedAadhaar && !isValidAadhaarNumber(normalizedAadhaar)) {
    return NextResponse.json(
      { error: "Invalid Aadhaar number checksum. Please verify and try again." },
      { status: 400 },
    );
  }
  const ip = getClientIp(request);
  const admin = createAdminClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const { url, anonKey } = validateSupabaseEnv();
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
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

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  let authUserId = currentUser?.id ?? null;
  const authUserEmail = currentUser?.email?.trim().toLowerCase() ?? null;
  let signUpCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  if (!authUserId) {
    const verifiedEmail = getPendingEmailVerification(request);
    if (!verifiedEmail || verifiedEmail !== email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Please verify your email before creating a tenant account." },
        { status: 400 },
      );
    }

    const {
      data: authData,
      error: createError,
      cookiesToSet: signUpCookiesResult,
    } = await registerWithEmailPassword(request, {
      email,
      password,
      metadata: { full_name: fullName, role: "tenant" },
      emailConfirmRedirectTo: `${appUrl}/auth/callback?next=/tenant/profile`,
    });

    if (createError) {
      if (isExistingUserError(createError.message)) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 },
        );
      }

      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    signUpCookies = signUpCookiesResult;
    authUserId = authData.user?.id ?? authData.session?.user?.id ?? null;

    if (!authUserId) {
      return NextResponse.json(
        { error: "Account creation failed. Please try again." },
        { status: 500 },
      );
    }
  } else {
    if (authUserEmail && authUserEmail !== email.trim().toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "Authenticated user email does not match the email provided for tenant registration.",
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await updateAuthUserPasswordAndOptionalEmail(
      request,
      authUserId,
      password,
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  const { error: metadataError } = await upsertAuthUserMetadata(authUserId, {
    full_name: fullName,
    name: fullName,
    role: "tenant",
  });

  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 400 });
  }

  // ── 1. Verify hostel is active and token matches ────────────────────────
  const { data: hostel, error: hostelError } = await admin
    .from("hostels")
    .select("id, name, owner_id, is_active, tenant_join_token")
    .eq("id", hostelId)
    .eq("tenant_join_token", token)
    .maybeSingle();

  if (hostelError) {
    return NextResponse.json({ error: hostelError.message }, { status: 500 });
  }

  if (!hostel) {
    return NextResponse.json(
      { error: "Invalid or expired invite link." },
      { status: 404 },
    );
  }

  if (!hostel.is_active) {
    return NextResponse.json(
      { error: "This property is not currently accepting registrations." },
      { status: 403 },
    );
  }

  if (normalizedAadhaar) {
    const aadhaarHash = hashAadhaar(normalizedAadhaar);
    const { data: existingTenant, error: existingTenantError } = await admin
      .from("tenants")
      .select("id")
      .eq("aadhar_number_hash", aadhaarHash)
      .maybeSingle();

    if (existingTenantError) {
      return NextResponse.json(
        { error: existingTenantError.message },
        { status: 500 },
      );
    }

    if (existingTenant) {
      return NextResponse.json(
        { error: "This Aadhaar number is already linked to an existing tenant." },
        { status: 409 },
      );
    }
  }

  const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;

  const duplicatePhoneCheck = await admin
    .from("owners")
    .select("id")
    .eq("phone_verified", true)
    .in("phone", normalizedPhone ? [normalizedPhone, normalizedPhone.slice(-10)] : [""])
    .maybeSingle();

  if (duplicatePhoneCheck.error) {
    return NextResponse.json(
      { error: duplicatePhoneCheck.error.message },
      { status: 500 },
    );
  }

  if (duplicatePhoneCheck.data) {
    return NextResponse.json(
      {
        error:
          "This mobile number is already registered to another verified owner account.",
      },
      { status: 409 },
    );
  }

  const tenantPhoneConflict = await admin
    .from("tenants")
    .select("id")
    .eq("phone_verified", true)
    .in("phone", normalizedPhone ? [normalizedPhone, normalizedPhone.slice(-10)] : [""])
    .maybeSingle();

  if (tenantPhoneConflict.error) {
    return NextResponse.json(
      { error: tenantPhoneConflict.error.message },
      { status: 500 },
    );
  }

  if (tenantPhoneConflict.data) {
    return NextResponse.json(
      {
        error:
          "This mobile number is already registered to another verified tenant account.",
      },
      { status: 409 },
    );
  }

  // ── 3. Insert tenant row ─────────────────────────────────────────────────
  const { error: tenantError } = await admin.from("tenants").insert({
    auth_user_id: authUserId,
    owner_id: hostel.owner_id,
    hostel_id: hostelId,
    full_name: fullName,
    email,
    phone: normalizedPhone || null,
    phone_verified: phoneVerified && Boolean(normalizedPhone),
    phone_verified_at:
      phoneVerified && Boolean(normalizedPhone) ? new Date().toISOString() : null,
    occupation_type: occupationType,
    institution_name: institutionName,
    gender,
    aadhar_number: normalizedAadhaar ? encryptAadhaar(normalizedAadhaar) : null,
    aadhar_number_hash: normalizedAadhaar ? hashAadhaar(normalizedAadhaar) : null,
    aadhar_last4: normalizedAadhaar ? normalizedAadhaar.slice(-4) : null,
    status: "pending",
  });

  if (tenantError) {
    if (
      tenantError.message
        .toLowerCase()
        .includes("idx_tenants_aadhar_number_hash_unique") ||
      tenantError.message.toLowerCase().includes("aadhar_number_hash")
    ) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);

      return NextResponse.json(
        { error: "This Aadhaar number is already linked to an existing tenant." },
        { status: 409 },
      );
    }

    const deleteResult = await admin.auth.admin.deleteUser(authUserId);
    if (deleteResult.error) {
      return NextResponse.json(
        {
          error:
            "Tenant registration failed and cleanup could not be completed. " +
            "Please contact support.",
          details: [tenantError.message, deleteResult.error.message],
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  // ── 4. Store consent record ──────────────────────────────────────────────
  if (consentGiven) {
    await admin.from("consent_records").insert({
      user_id: authUserId,
      consent_type: "data_collection",
      consent_given: true,
      ip_address: ip,
      form_version: "tenant-register-v1",
    });
  }

  // ── 5. Audit log ─────────────────────────────────────────────────────────
  await admin.from("audit_logs").insert({
    owner_id: hostel.owner_id,
    user_id: authUserId,
    action: "INSERT",
    table_name: "tenants",
    record_id: null,
    new_value: {
      email,
      full_name: fullName,
      hostel_id: hostelId,
      status: "pending",
    },
    ip_address: ip,
  });

  const loginResult = await loginWithEmailPassword(request, email, password);
  if (loginResult.error || !loginResult.data.session) {
    return NextResponse.json(
      {
        error:
          loginResult.error?.message ??
          "Account created, but we could not start your session. Please sign in manually.",
      },
      { status: 500 },
    );
  }

  const payload = {
    success: true,
    message: "Account created successfully. Redirecting to your dashboard...",
    redirectTo: "/tenant/dashboard",
  };

  if (signUpCookies.length) {
    cookiesToSet.push(...signUpCookies);
  }

  if (loginResult.cookiesToSet.length) {
    cookiesToSet.push(...loginResult.cookiesToSet);
  }

  const response = NextResponse.json(payload);
  applySupabaseCookies(response, cookiesToSet);
  clearPendingEmailVerificationCookie(response);
  return response;
}

