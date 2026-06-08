import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isValidAadhaarNumber, normalizeAadhaarNumber } from "../../../../lib/aadhaar";
import { getTenantProfileCompletion } from "../../../../lib/tenant-profile-completion";

const TENANT_DOCS_BUCKET = "tenant-documents";

async function createSignedUrl(
  path: string | null,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

// ── GET /api/tenant/profile ──────────────────────────────────────────────────
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
  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, full_name, email, phone, status, occupation_type, institution_name, aadhar_number, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, first_activated_at, hostels(name, address, city, state, pincode, property_type)",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  // @ts-expect-error supabase nested select type
  const hostel = tenant.hostels as {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    property_type: string;
  } | null;

  const completion = getTenantProfileCompletion(tenant);

  const [profilePhotoUrl, aadharFrontUrl, aadharBackUrl, alternateIdUrl] =
    await Promise.all([
      createSignedUrl(tenant.profile_photo_path, admin),
      createSignedUrl(tenant.aadhar_front_path, admin),
      createSignedUrl(tenant.aadhar_back_path, admin),
      createSignedUrl(tenant.alternate_id_path, admin),
    ]);

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
      occupation_type: tenant.occupation_type,
      institution_name: tenant.institution_name,
      aadhar_number: tenant.aadhar_number,
      profile_photo_path: tenant.profile_photo_path,
      aadhar_front_path: tenant.aadhar_front_path,
      aadhar_back_path: tenant.aadhar_back_path,
      alternate_id_path: tenant.alternate_id_path,
      profile_photo_url: profilePhotoUrl,
      aadhar_front_url: aadharFrontUrl,
      aadhar_back_url: aadharBackUrl,
      alternate_id_url: alternateIdUrl,
      first_activated_at: tenant.first_activated_at,
      hostel_name: hostel?.name ?? null,
      hostel_address: hostel?.address ?? null,
      hostel_city: hostel?.city ?? null,
      hostel_state: hostel?.state ?? null,
      hostel_pincode: hostel?.pincode ?? null,
      property_type: hostel?.property_type ?? null,
      profile_completion_percentage: completion.percentage,
      profile_completion_missing: completion.missingFields,
      profile_completion_counts: {
        complete: completion.completeCount,
        total: completion.totalCount,
      },
    },
  });
}

// ── PATCH /api/tenant/profile ────────────────────────────────────────────────
const updateSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters.").max(100),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits.")
    .or(z.literal(""))
    .optional(),
  occupationType: z
    .enum(["student", "working_professional", "business", "other"])
    .optional(),
  institutionName: z
    .string()
    .min(2, "Institution name must be at least 2 characters.")
    .max(120)
    .optional(),
  aadharNumber: z
    .string()
    .regex(/^\d{12}$/)
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const normalizedAadhaar = parsed.data.aadharNumber
    ? normalizeAadhaarNumber(parsed.data.aadharNumber)
    : undefined;

  if (normalizedAadhaar && !isValidAadhaarNumber(normalizedAadhaar)) {
    return NextResponse.json(
      { error: "Invalid Aadhaar number checksum." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("tenants")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      occupation_type: parsed.data.occupationType,
      institution_name: parsed.data.institutionName,
      aadhar_number: normalizedAadhaar,
      aadhar_last4: normalizedAadhaar ? normalizedAadhaar.slice(-4) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenant.id);

  if (error) {
    if (error.message.toLowerCase().includes("idx_tenants_aadhar_number_unique")) {
      return NextResponse.json(
        { error: "This Aadhaar number is already linked to another tenant." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
