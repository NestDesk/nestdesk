import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      "id, full_name, email, phone, status, hostels(name, address, city, state, pincode, property_type)",
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

  return NextResponse.json({
    tenant: {
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
      hostel_name: hostel?.name ?? null,
      hostel_address: hostel?.address ?? null,
      hostel_city: hostel?.city ?? null,
      hostel_state: hostel?.state ?? null,
      hostel_pincode: hostel?.pincode ?? null,
      property_type: hostel?.property_type ?? null,
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

  const { error } = await admin
    .from("tenants")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
