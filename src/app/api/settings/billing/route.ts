import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// GET /api/settings/billing
export async function GET() {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const admin = createAdminClient();
  const { data } = await admin
    .from("owner_billing")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return NextResponse.json(data ?? {});
}

const billingSchema = z.object({
  gst_number: z.string().max(15).optional().nullable(),
  pan_number: z.string().max(10).optional().nullable(),
  business_name: z.string().max(120).optional().nullable(),
  billing_address: z.string().max(300).optional().nullable(),
});

// PUT /api/settings/billing
export async function PUT(req: NextRequest) {
  const ownerId = await getOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;

  const body = await req.json();
  const parsed = billingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("owner_billing")
    .upsert(
      { owner_id: ownerId, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
