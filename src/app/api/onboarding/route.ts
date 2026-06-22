import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { z } from "zod";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { normalizeIndianPhone } from "../../../lib/phone";

const onboardingSchema = z.object({
  // Owner details
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  phoneVerified: z.boolean().optional().default(false),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(150).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  ownerPincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
});

type OnboardingOwnerData = {
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  ownerPincode: string;
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function getUserPhone(user: {
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const directPhone = user.phone;
  if (typeof directPhone === "string" && directPhone.trim().length > 0) {
    return directPhone.trim();
  }

  const metaPhone = user.user_metadata?.phone;
  if (typeof metaPhone === "string" && metaPhone.trim().length > 0) {
    return metaPhone.trim();
  }

  return null;
}

function getUserFullName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const metaFullName = user.user_metadata?.full_name;
  if (typeof metaFullName === "string" && metaFullName.trim().length >= 2) {
    return metaFullName.trim();
  }
  return null;
}

function toTenDigitPhone(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(-10);
}

function normalizeText(value: string): string {
  return value.trim();
}

function fetchPincodeData(pincode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.postalpincode.in",
        path: `/pincode/${encodeURIComponent(pincode)}`,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        agent: new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

async function verifyCityStateForPincode(
  pincode: string,
  city: string,
  state: string,
): Promise<boolean> {
  try {
    const raw = await fetchPincodeData(pincode);
    const payload = JSON.parse(raw) as Array<{
      Status?: string;
      PostOffice?: Array<{ Name?: string; District?: string; State?: string }>;
    }>;

    if (!Array.isArray(payload) || payload.length === 0) {
      return false;
    }

    const result = payload[0];
    if (result.Status !== "Success" || !Array.isArray(result.PostOffice)) {
      return false;
    }

    const normalizedCity = normalizeText(city).toLowerCase();
    const normalizedState = normalizeText(state).toLowerCase();

    return result.PostOffice.some(
      (office: { State?: string; District?: string; Name?: string }) => {
        const officeState = normalizeText(String(office.State ?? "")).toLowerCase();
        const officeDistrict = normalizeText(
          String(office.District ?? ""),
        ).toLowerCase();
        const officeName = normalizeText(String(office.Name ?? "")).toLowerCase();

        const stateMatches = officeState === normalizedState;
        const cityMatches =
          officeDistrict === normalizedCity ||
          officeName === normalizedCity ||
          officeDistrict.includes(normalizedCity) ||
          officeName.includes(normalizedCity) ||
          normalizedCity.includes(officeDistrict) ||
          normalizedCity.includes(officeName);

        return stateMatches && cityMatches;
      },
    );
  } catch {
    return false;
  }
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const ownerResult = await admin
    .from("owners")
    .select(
      "id, full_name, phone, address_line1, address_line2, landmark, city, state, pincode, onboarding_completed",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return NextResponse.json({ error: ownerResult.error.message }, { status: 500 });
  }

  const owner = ownerResult.data;
  if (!owner) {
    return NextResponse.json({
      success: true,
      ownerName:
        getUserFullName({ user_metadata: user.user_metadata }) ||
        user.email?.split("@")[0] ||
        "Owner",
      onboardingCompleted: false,
      ownerData: null,
      hostelData: null,
    });
  }

  const hostelResult = await admin
    .from("hostels")
    .select("name, property_type, address, city, state, pincode, total_rooms")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (hostelResult.error) {
    return NextResponse.json({ error: hostelResult.error.message }, { status: 500 });
  }

  const ownerData: OnboardingOwnerData | null = {
    phone: toTenDigitPhone(owner.phone),
    addressLine1: owner.address_line1 ?? "",
    addressLine2: owner.address_line2 ?? "",
    landmark: owner.landmark ?? "",
    city: owner.city ?? "",
    state: owner.state ?? "",
    ownerPincode: owner.pincode ?? "",
  };

  const hostel = hostelResult.data;
  const hostelData = hostel
    ? {
        hostelName: hostel.name,
        propertyType: hostel.property_type,
        address: hostel.address,
        hostelCity: hostel.city,
        hostelState: hostel.state,
        pincode: hostel.pincode,
        totalRooms: hostel.total_rooms,
      }
    : null;

  return NextResponse.json({
    success: true,
    ownerName: owner.full_name,
    onboardingCompleted: owner.onboarding_completed,
    ownerData,
    hostelData,
  });
}

export async function POST(request: NextRequest) {
  // ── 1. Verify authenticated session ────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse + validate body ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  const isValidLocation = await verifyCityStateForPincode(
    data.ownerPincode,
    data.city,
    data.state,
  );

  if (!isValidLocation) {
    return NextResponse.json(
      {
        error: "Pincode does not match the provided city and state.",
      },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const admin = createAdminClient();
  const phoneFromAuth = getUserPhone({
    phone: user.phone,
    user_metadata: user.user_metadata,
  });

  const inputDigits = String(data.phone ?? "")
    .replace(/\D/g, "")
    .slice(0, 10);
  const authDigits = String(phoneFromAuth ?? "")
    .replace(/\D/g, "")
    .slice(-10);
  const normalizedPhone = normalizeIndianPhone(inputDigits || authDigits);

  // ── 3. Check if owner already onboarded (idempotency guard) ────────────
  const existingByUserId = await admin
    .from("owners")
    .select("id, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingByUserId.error) {
    return NextResponse.json(
      { error: existingByUserId.error.message },
      { status: 500 },
    );
  }

  const existing = existingByUserId.data;

  if (existing?.onboarding_completed) {
    return NextResponse.json(
      { success: true, redirectTo: "/dashboard" },
      { status: 200 },
    );
  }

  const duplicatePhoneCheck = await admin
    .from("owners")
    .select("id, full_name, email, phone_verified, onboarding_completed")
    .eq("phone", normalizedPhone)
    .neq("user_id", user.id)
    .or("phone_verified.eq.true,onboarding_completed.eq.true")
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
          "This mobile number is already registered to another verified or completed owner account.",
      },
      { status: 409 },
    );
  }

  // ── 4. Save owner profile ───────────────────────────────────────────────
  const ownerPayload = {
    user_id: user.id,
    full_name: getUserFullName(user) || "Owner",
    email: user.email?.trim().toLowerCase() ?? null,
    phone: normalizedPhone,
    address_line1: normalizeText(data.addressLine1),
    address_line2: normalizeOptionalText(data.addressLine2),
    landmark: normalizeOptionalText(data.landmark),
    city: normalizeText(data.city),
    state: normalizeText(data.state),
    pincode: data.ownerPincode,
    kyc_address_verified: false,
    phone_verified: data.phoneVerified ?? false,
    phone_verified_at: data.phoneVerified ? new Date().toISOString() : null,
    onboarding_completed: existing?.onboarding_completed ?? false,
  };

  const ownerResult = await admin
    .from("owners")
    .upsert(ownerPayload, { onConflict: "user_id" })
    .select("id")
    .single();

  if (ownerResult.error || !ownerResult.data) {
    return NextResponse.json(
      {
        error: ownerResult.error?.message ?? "Failed to save owner profile.",
      },
      { status: 500 },
    );
  }

  const owner = ownerResult.data;

  // ── 5. Mark onboarding complete ─────────────────────────────────────────
  const { error: completionError } = await admin
    .from("owners")
    .update({ onboarding_completed: true })
    .eq("id", owner.id);

  if (completionError) {
    return NextResponse.json(
      { error: "Failed to finalize onboarding." },
      { status: 500 },
    );
  }

  // ── 6. Write audit log ──────────────────────────────────────────────────
  await admin.from("audit_logs").insert({
    owner_id: owner.id,
    user_id: user.id,
    action: existing ? "UPDATE" : "CREATE",
    table_name: "owners",
    record_id: owner.id,
    new_value: {
      full_name: getUserFullName(user) || "Owner",
      phone: normalizedPhone,
      address_line1: normalizeText(data.addressLine1),
      address_line2: normalizeOptionalText(data.addressLine2),
      landmark: normalizeOptionalText(data.landmark),
      city: normalizeText(data.city),
      state: normalizeText(data.state),
      pincode: data.ownerPincode,
    },
    ip_address: ip,
  });

  return NextResponse.json({ success: true, redirectTo: "/dashboard" });
}
