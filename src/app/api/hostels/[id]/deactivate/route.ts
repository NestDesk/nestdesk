import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { createClient } from "../../../../../lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const { id: hostelId } = parsedParams.data;

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
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return NextResponse.json({ error: ownerResult.error.message }, { status: 500 });
  }

  const ownerId = ownerResult.data?.id;
  if (!ownerId) {
    return NextResponse.json(
      { error: "Complete onboarding before managing properties." },
      { status: 409 },
    );
  }

  const hostelResult = await admin
    .from("hostels")
    .select("id, is_active")
    .eq("id", hostelId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (hostelResult.error) {
    return NextResponse.json({ error: hostelResult.error.message }, { status: 500 });
  }

  if (!hostelResult.data) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  if (!hostelResult.data.is_active) {
    return NextResponse.json({
      success: true,
      message: "Property is already inactive.",
    });
  }

  const updateResult = await admin
    .from("hostels")
    .update({ is_active: false })
    .eq("id", hostelId)
    .eq("owner_id", ownerId);

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Property deactivated." });
}
