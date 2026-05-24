import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
});

const updateRoomSchema = z.object({
  floorId: z.string().uuid(),
  roomNumber: z.string().min(1, "Room number is required.").max(40),
  capacity: z.number().int().min(1).max(6),
  rentAmount: z.number().min(0).max(1000000),
  status: z.enum(["vacant", "occupied", "maintenance", "inactive"]),
});

function normalizeText(value: string): string {
  return value.trim();
}

async function resolveOwnerAndRoom(hostelId: string, roomId: string) {
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

  const roomResult = await admin
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("hostel_id", hostelId)
    .is("deleted_at", null)
    .maybeSingle();

  if (roomResult.error) {
    return { error: roomResult.error.message, status: 500 as const };
  }

  if (!roomResult.data) {
    return { error: "Room not found.", status: 404 as const };
  }

  return { admin };
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; roomId: string }> | { id: string; roomId: string };
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

  const parsedBody = updateRoomSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const resolved = await resolveOwnerAndRoom(
    parsedParams.data.id,
    parsedParams.data.roomId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const floorResult = await resolved.admin
    .from("floors")
    .select("id")
    .eq("id", parsedBody.data.floorId)
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (floorResult.error) {
    return NextResponse.json({ error: floorResult.error.message }, { status: 500 });
  }

  if (!floorResult.data) {
    return NextResponse.json(
      { error: "Selected floor not found." },
      { status: 400 },
    );
  }

  const updateResult = await resolved.admin
    .from("rooms")
    .update({
      floor_id: parsedBody.data.floorId,
      room_number: normalizeText(parsedBody.data.roomNumber),
      capacity: parsedBody.data.capacity,
      rent_amount: parsedBody.data.rentAmount,
      status: parsedBody.data.status,
    })
    .eq("id", parsedParams.data.roomId)
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null)
    .select("id, floor_id, room_number, capacity, rent_amount, status, created_at")
    .single();

  if (updateResult.error || !updateResult.data) {
    const message = updateResult.error?.message ?? "Failed to update room.";
    const duplicate = message.toLowerCase().includes("duplicate");

    return NextResponse.json(
      {
        error: duplicate ? "Room number already exists in this property." : message,
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true, room: updateResult.data });
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string; roomId: string }> | { id: string; roomId: string };
  },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request params." }, { status: 400 });
  }

  const resolved = await resolveOwnerAndRoom(
    parsedParams.data.id,
    parsedParams.data.roomId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const deleteResult = await resolved.admin
    .from("rooms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsedParams.data.roomId)
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null);

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
