import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

async function getOwnerHostelIds(ownerId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("hostels").select("id").eq("owner_id", ownerId);
  return (data ?? []).map((h) => h.id);
}

async function getOwnerId(): Promise<string | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owner)
    return NextResponse.json({ error: "Owner not found." }, { status: 403 });

  return owner.id;
}

// GET /api/settings/property-terms — returns all terms for owner's hostels
export async function GET() {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const hostelIds = await getOwnerHostelIds(ownerId);
  if (hostelIds.length === 0) return NextResponse.json([]);

  const admin = createAdminClient();
  const { data } = await admin
    .from("property_terms")
    .select("hostel_id, content, is_default, updated_at")
    .in("hostel_id", hostelIds);

  return NextResponse.json(data ?? []);
}

const termsSchema = z.object({
  hostel_id: z.string().uuid(),
  content: z.string().max(20000),
});

// PUT /api/settings/property-terms — upsert terms for one hostel
export async function PUT(req: NextRequest) {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const body = await req.json();
  const parsed = termsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Verify the hostel belongs to this owner
  const hostelIds = await getOwnerHostelIds(ownerId);
  if (!hostelIds.includes(parsed.data.hostel_id)) {
    return NextResponse.json({ error: "Hostel not found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("property_terms").upsert(
    {
      hostel_id: parsed.data.hostel_id,
      content: parsed.data.content,
      is_default: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "hostel_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
