import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

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

// GET /api/settings/support-staff
export async function GET() {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const admin = createAdminClient();
  const { data } = await admin
    .from("support_staff")
    .select("id, name, phone, designation, hostel_id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  return NextResponse.json(data ?? []);
}

const staffSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  designation: z.string().min(1).max(60),
  hostel_id: z.string().uuid().optional().nullable(),
});

// POST /api/settings/support-staff — add a new staff member
export async function POST(req: NextRequest) {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const body = await req.json();
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_staff")
    .insert({
      owner_id: ownerId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      designation: parsed.data.designation,
      hostel_id: parsed.data.hostel_id ?? null,
    })
    .select("id, name, phone, designation, hostel_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// DELETE /api/settings/support-staff?id=<uuid>
export async function DELETE(req: NextRequest) {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_staff")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId); // ensures ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
