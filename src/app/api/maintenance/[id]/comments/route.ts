import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const commentSchema = z.object({
  comment: z.string().min(2, "Comment must be at least 2 characters.").max(1000),
});

async function getOwnerId() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return {
      error: NextResponse.json(
        { error: "Owner account not found." },
        { status: 403 },
      ),
    };
  }

  return { ownerId: owner.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const owner = await getOwnerId();
  if (owner.error) {
    return owner.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: maintenance } = await admin
    .from("maintenance_requests")
    .select("id, hostel_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!maintenance) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const { data: hostel } = await admin
    .from("hostels")
    .select("id")
    .eq("id", maintenance.hostel_id)
    .eq("owner_id", owner.ownerId)
    .maybeSingle();

  if (!hostel) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: inserted, error } = await admin
    .from("maintenance_request_comments")
    .insert({
      maintenance_request_id: maintenance.id,
      owner_id: owner.ownerId,
      comment: parsed.data.comment,
    })
    .select("id, comment, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin
    .from("maintenance_requests")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", maintenance.id);

  await admin.from("audit_logs").insert({
    owner_id: owner.ownerId,
    action: "INSERT",
    table_name: "maintenance_request_comments",
    record_id: inserted?.id ?? null,
    new_value: {
      maintenance_request_id: maintenance.id,
      comment: parsed.data.comment,
    },
  });

  return NextResponse.json({ success: true, comment: inserted });
}
