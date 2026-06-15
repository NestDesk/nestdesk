import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../../../lib/supabase/admin";
import { createClient } from "../../../../../../lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
});

const updateFloorSchema = z.object({
  name: z.string().min(1, "Floor name is required.").max(100),
});

function normalizeText(value: string): string {
  return value.trim();
}

async function resolveOwnerAndFloor(hostelId: string, floorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  const admin = createAdminClient();

  const ownerResult = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return { error: ownerResult.error.message, status: 500 as const };
  }

  const ownerId = ownerResult.data?.id;
  if (!ownerId) {
    return {
      error: "Complete onboarding before managing floor plans.",
      status: 409 as const,
    };
  }

  const floorResult = await admin
    .from("floors")
    .select("id")
    .eq("id", floorId)
    .eq("hostel_id", hostelId)
    .is("deleted_at", null)
    .maybeSingle();

  if (floorResult.error) {
    return { error: floorResult.error.message, status: 500 as const };
  }

  if (!floorResult.data) {
    return { error: "Floor not found.", status: 404 as const };
  }

  const hostelResult = await admin
    .from("hostels")
    .select("id")
    .eq("id", hostelId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (hostelResult.error) {
    return { error: hostelResult.error.message, status: 500 as const };
  }

  if (!hostelResult.data) {
    return { error: "Property not found.", status: 404 as const };
  }

  return { admin };
}

export async function PATCH(
  request: NextRequest,
  context: {
    params:
      | Promise<{ id: string; floorId: string }>
      | { id: string; floorId: string };
  },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request params." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedBody = updateFloorSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const resolved = await resolveOwnerAndFloor(
    parsedParams.data.id,
    parsedParams.data.floorId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const normalizedName = normalizeText(parsedBody.data.name);

  const floorsResult = await resolved.admin
    .from("floors")
    .select("id, name")
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null);

  if (floorsResult.error) {
    return NextResponse.json({ error: floorsResult.error.message }, { status: 500 });
  }

  const duplicate = (floorsResult.data ?? []).some(
    (floor) =>
      floor.id !== parsedParams.data.floorId &&
      normalizeText(floor.name).toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `Floor "${normalizedName}" already exists.` },
      { status: 409 },
    );
  }

  const updateResult = await resolved.admin
    .from("floors")
    .update({ name: normalizedName })
    .eq("id", parsedParams.data.floorId)
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null)
    .select("id, name, created_at")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { error: updateResult.error?.message ?? "Failed to update floor." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, floor: updateResult.data });
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params:
      | Promise<{ id: string; floorId: string }>
      | { id: string; floorId: string };
  },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request params." }, { status: 400 });
  }

  const resolved = await resolveOwnerAndFloor(
    parsedParams.data.id,
    parsedParams.data.floorId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const deletedAt = new Date().toISOString();

  const [floorDeleteResult, roomsDeleteResult] = await Promise.all([
    resolved.admin
      .from("floors")
      .update({ deleted_at: deletedAt })
      .eq("id", parsedParams.data.floorId)
      .eq("hostel_id", parsedParams.data.id)
      .is("deleted_at", null),
    resolved.admin
      .from("rooms")
      .update({ deleted_at: deletedAt })
      .eq("floor_id", parsedParams.data.floorId)
      .eq("hostel_id", parsedParams.data.id)
      .is("deleted_at", null),
  ]);

  if (floorDeleteResult.error) {
    return NextResponse.json(
      { error: floorDeleteResult.error.message },
      { status: 500 },
    );
  }

  if (roomsDeleteResult.error) {
    return NextResponse.json(
      { error: roomsDeleteResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
