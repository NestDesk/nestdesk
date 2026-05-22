import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

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
  const ip = getClientIp(request);

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

  if (hostelResult.data.is_active) {
    return NextResponse.json({
      success: true,
      message: "Property is already active.",
    });
  }

  const [floorsCountResult, roomsCountResult] = await Promise.all([
    admin
      .from("floors")
      .select("id", { count: "exact", head: true })
      .eq("hostel_id", hostelId)
      .is("deleted_at", null),
    admin
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("hostel_id", hostelId)
      .is("deleted_at", null),
  ]);

  if (floorsCountResult.error) {
    return NextResponse.json(
      { error: floorsCountResult.error.message },
      { status: 500 },
    );
  }

  if (roomsCountResult.error) {
    return NextResponse.json(
      { error: roomsCountResult.error.message },
      { status: 500 },
    );
  }

  const floorCount = floorsCountResult.count ?? 0;
  const roomCount = roomsCountResult.count ?? 0;
  const floorPlanComplete = floorCount > 0 && roomCount > 0;

  if (!floorPlanComplete) {
    return NextResponse.json(
      {
        error:
          "Complete floor plan first. Add at least one floor and one room before activation.",
      },
      { status: 409 },
    );
  }

  const activateResult = await admin
    .from("hostels")
    .update({ is_active: true })
    .eq("id", hostelId)
    .eq("owner_id", ownerId)
    .select("id")
    .single();

  if (activateResult.error) {
    return NextResponse.json(
      { error: activateResult.error.message },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    owner_id: ownerId,
    user_id: user.id,
    action: "UPDATE",
    table_name: "hostels",
    record_id: hostelId,
    old_value: { is_active: false },
    new_value: { is_active: true },
    ip_address: ip,
  });

  return NextResponse.json({
    success: true,
    message: "Property activated successfully.",
  });
}
