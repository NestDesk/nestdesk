import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { validateSupabaseEnv } from "@/lib/supabase/env-check";
import { isValidAadhaarNumber, normalizeAadhaarNumber } from "@/lib/aadhaar";

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

  // ── 2. Create Supabase Auth user ────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  let authUserId: string;
  let requiresEmailVerification: boolean;

  // Collect session cookies to attach to the final response
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const { url, anonKey } = validateSupabaseEnv();
  const supabaseClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookiesToSet.push(...cookies);
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    // Dev: create confirmed user immediately
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "tenant" },
    });

    if (createError) {
      if (createError.message.toLowerCase().includes("already")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    authUserId = created.user.id;
    requiresEmailVerification = false;

    // Sign the user in immediately so session cookies are set on this response.
    // Without this, client-side router.push("/tenant/...") has no active session.
    await supabaseClient.auth.signInWithPassword({ email, password });
  } else {
    // Prod: sign up via Supabase (sends verification email)
    const { data: signUpData, error: signUpError } =
      await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: "tenant" },
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: "Account creation failed. Please try again." },
        { status: 500 },
      );
    }

    authUserId = signUpData.user.id;
    requiresEmailVerification = !signUpData.user.confirmed_at;
  }

  // ── 3. Insert tenant row ─────────────────────────────────────────────────
  const { error: tenantError } = await admin.from("tenants").insert({
    auth_user_id: authUserId,
    owner_id: hostel.owner_id,
    hostel_id: hostelId,
    full_name: fullName,
    email,
    phone: phone || null,
    occupation_type: occupationType,
    institution_name: institutionName,
    gender,
    aadhar_number: normalizedAadhaar,
    aadhar_last4: normalizedAadhaar ? normalizedAadhaar.slice(-4) : null,
    status: "pending",
  });

  if (tenantError) {
    if (
      tenantError.message.toLowerCase().includes("idx_tenants_aadhar_number_unique")
    ) {
      return NextResponse.json(
        { error: "This Aadhaar number is already linked to an existing tenant." },
        { status: 409 },
      );
    }
    // If tenant row insert fails but auth user was created in prod,
    // the verification email is already sent — user can still verify and we
    // can handle orphan cleanup separately. For now return the error.
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

  const payload = {
    success: true,
    requiresEmailVerification,
    redirectTo: requiresEmailVerification ? null : "/tenant/profile",
    message: requiresEmailVerification
      ? "Account created. Please check your email to verify your account."
      : "Account created successfully.",
  };

  // Attach session cookies to the response so the browser is logged in immediately.
  const response = NextResponse.json(payload);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });
  return response;
}
