import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createRoomSchema = z.object({
  floorId: z.string().uuid(),
  roomNumber: z.string().min(1, "Room number is required.").max(40),
  capacity: z.number().int().min(1).max(6),
  rentAmount: z.number().min(0).max(1000000),
  status: z.enum(["vacant", "occupied", "maintenance", "inactive"]),
});

function normalizeText(value: string): string {
  return value.trim();
}

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const resolved = await resolveOwnerAndHostel(parsedParams.data.id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const roomsResult = await resolved.admin
    .from("rooms")
    .select("id, floor_id, room_number, capacity, rent_amount, status, created_at")
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (roomsResult.error) {
    return NextResponse.json({ error: roomsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rooms: roomsResult.data ?? [],
  });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedBody = createRoomSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const resolved = await resolveOwnerAndHostel(parsedParams.data.id);
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

  const insertResult = await resolved.admin
    .from("rooms")
    .insert({
      hostel_id: parsedParams.data.id,
      floor_id: parsedBody.data.floorId,
      room_number: normalizeText(parsedBody.data.roomNumber),
      capacity: parsedBody.data.capacity,
      rent_amount: parsedBody.data.rentAmount,
      status: parsedBody.data.status,
    })
    .select("id, floor_id, room_number, capacity, rent_amount, status, created_at")
    .single();

  if (insertResult.error || !insertResult.data) {
    const message = insertResult.error?.message ?? "Failed to create room.";
    const duplicate = message.toLowerCase().includes("duplicate");

    return NextResponse.json(
      {
        error: duplicate ? "Room number already exists in this property." : message,
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true, room: insertResult.data });
}
