import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
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

  // Verify property belongs to this owner
  const hostelResult = await admin
    .from("hostels")
    .select("id, name")
    .eq("id", hostelId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (hostelResult.error) {
    return NextResponse.json({ error: hostelResult.error.message }, { status: 500 });
  }

  if (!hostelResult.data) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  // Delete rooms first (foreign key dependency on floors)
  const deleteRoomsResult = await admin
    .from("rooms")
    .delete()
    .eq("hostel_id", hostelId);

  if (deleteRoomsResult.error) {
    return NextResponse.json(
      { error: `Failed to delete rooms: ${deleteRoomsResult.error.message}` },
      { status: 500 },
    );
  }

  // Delete floors
  const deleteFloorsResult = await admin
    .from("floors")
    .delete()
    .eq("hostel_id", hostelId);

  if (deleteFloorsResult.error) {
    return NextResponse.json(
      { error: `Failed to delete floors: ${deleteFloorsResult.error.message}` },
      { status: 500 },
    );
  }

  // Delete the hostel itself
  const deleteHostelResult = await admin
    .from("hostels")
    .delete()
    .eq("id", hostelId)
    .eq("owner_id", ownerId);

  if (deleteHostelResult.error) {
    return NextResponse.json(
      { error: `Failed to delete property: ${deleteHostelResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message: "Property deleted." });
}
