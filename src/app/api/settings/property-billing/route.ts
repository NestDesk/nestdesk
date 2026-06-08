import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const BillingSchema = z.object({
  gst_number: z.string().max(15).optional().or(z.null()),
  pan_number: z.string().max(10).optional().or(z.null()),
  business_name: z.string().max(120).optional().or(z.null()),
  billing_address: z.string().max(300).optional().or(z.null()),
});

type BillingData = z.infer<typeof BillingSchema>;

function formatHostelAddress(hostel: {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}) {
  return [hostel.address, hostel.city, hostel.state, hostel.pincode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

async function getOwnerId(): Promise<string | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: "Owner not found." }, { status: 403 });
  }

  return owner.id;
}

async function getOwnerHostels(ownerId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hostels")
    .select("id, name, address, city, state, pincode")
    .eq("owner_id", ownerId);

  return data ?? [];
}

// GET all property billing for owner's hostels
export async function GET() {
  try {
    const ownerId = await getOwnerId();
    if (ownerId instanceof NextResponse) return ownerId;

    const hostels = await getOwnerHostels(ownerId);

    if (!hostels || hostels.length === 0) {
      return NextResponse.json({});
    }

    const hostelIds = hostels.map((h) => h.id);

    const admin = createAdminClient();
    const { data: billingData } = await admin
      .from("property_billing")
      .select("*")
      .in("hostel_id", hostelIds);

    const billingMap: Record<
      string,
      BillingData & { name: string; address: string }
    > = {};
    hostels.forEach((hostel) => {
      const billing = billingData?.find((b) => b.hostel_id === hostel.id);
      billingMap[hostel.id] = {
        name: hostel.name,
        address: formatHostelAddress(hostel),
        gst_number: billing?.gst_number || null,
        pan_number: billing?.pan_number || null,
        business_name: billing?.business_name || null,
        billing_address: billing?.billing_address || null,
      };
    });

    return NextResponse.json(billingMap);
  } catch (err) {
    console.error("GET /api/settings/property-billing:", err);
    return NextResponse.json(
      { error: "Failed to fetch billing details" },
      { status: 500 },
    );
  }
}

// PUT (upsert) billing details for a specific property
export async function PUT(request: NextRequest) {
  try {
    const ownerId = await getOwnerId();
    if (ownerId instanceof NextResponse) return ownerId;

    const body = await request.json();
    const { hostel_id, ...billingData } = body;

    if (!hostel_id) {
      return NextResponse.json({ error: "hostel_id is required" }, { status: 400 });
    }

    const parsed = BillingSchema.safeParse(billingData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data: hostel } = await admin
      .from("hostels")
      .select("id")
      .eq("id", hostel_id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!hostel) {
      return NextResponse.json(
        { error: "Property not found or not owned by you" },
        { status: 403 },
      );
    }

    const { error } = await admin.from("property_billing").upsert(
      {
        hostel_id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hostel_id" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/settings/property-billing:", err);
    return NextResponse.json(
      { error: "Failed to save billing details" },
      { status: 500 },
    );
  }
}
