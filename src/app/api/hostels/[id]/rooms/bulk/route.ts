import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bulkRoomItem = z.object({
  floorId: z.string().uuid(),
  roomNumber: z.string().min(1).max(40),
  capacity: z.number().int().min(1).max(6),
});

const bulkRoomsSchema = z.object({
  rooms: z.array(bulkRoomItem).min(1).max(200),
});

async function resolveOwnerAndHostel(hostelId: string) {
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
      error: "Complete onboarding before managing rooms.",
      status: 409 as const,
    };
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const hostelId = parsedParams.data.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedBody = bulkRoomsSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const resolved = await resolveOwnerAndHostel(hostelId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  // Verify all referenced floor IDs belong to this hostel
  const floorIds = [...new Set(parsedBody.data.rooms.map((r) => r.floorId))];
  const floorsResult = await resolved.admin
    .from("floors")
    .select("id")
    .eq("hostel_id", hostelId)
    .in("id", floorIds)
    .is("deleted_at", null);

  if (floorsResult.error) {
    return NextResponse.json({ error: floorsResult.error.message }, { status: 500 });
  }

  const validFloorIds = new Set(floorsResult.data?.map((f) => f.id) ?? []);
  const invalidFloor = parsedBody.data.rooms.find(
    (r) => !validFloorIds.has(r.floorId),
  );
  if (invalidFloor) {
    return NextResponse.json(
      { error: `Floor not found for room ${invalidFloor.roomNumber}.` },
      { status: 400 },
    );
  }

  // Check for existing room numbers in this hostel (skip duplicates, don't fail)
  const roomNumbers = parsedBody.data.rooms.map((r) => r.roomNumber.trim());
  const existingResult = await resolved.admin
    .from("rooms")
    .select("room_number")
    .eq("hostel_id", hostelId)
    .in("room_number", roomNumbers)
    .is("deleted_at", null);

  if (existingResult.error) {
    return NextResponse.json(
      { error: existingResult.error.message },
      { status: 500 },
    );
  }

  const existingNumbers = new Set(
    existingResult.data?.map((r) => r.room_number) ?? [],
  );

  const toInsert = parsedBody.data.rooms
    .filter((r) => !existingNumbers.has(r.roomNumber.trim()))
    .map((r) => ({
      hostel_id: hostelId,
      floor_id: r.floorId,
      room_number: r.roomNumber.trim(),
      capacity: r.capacity,
      rent_amount: 0,
      status: "vacant" as const,
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      inserted: 0,
      skipped: parsedBody.data.rooms.length,
      message: "All room numbers already exist — nothing inserted.",
    });
  }

  const insertResult = await resolved.admin
    .from("rooms")
    .insert(toInsert)
    .select("id, floor_id, room_number, capacity, rent_amount, status, created_at");

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    inserted: toInsert.length,
    skipped: parsedBody.data.rooms.length - toInsert.length,
    rooms: insertResult.data ?? [],
  });
}
