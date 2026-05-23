import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateTenantSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits.")
    .or(z.literal(""))
    .optional(),
  status: z.enum(["pending", "active", "moved_out", "rejected"]).optional(),
  roomId: z.string().uuid().nullable().optional(),
  agreedRentAmount: z.number().positive().max(1000000).nullable().optional(),
  joinDate: z.string().date().nullable().optional(),
  moveOutDate: z.string().date().nullable().optional(),
});

type OwnerContext = {
  ownerId: string;
  userId: string;
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function getOwnerContext(): Promise<OwnerContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  return { ownerId: owner.id, userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tenant id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedBody = updateTenantSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(
      "id, owner_id, hostel_id, room_id, status, agreed_rent_amount, join_date, move_out_date, full_name, phone",
    )
    .eq("id", parsedParams.data.id)
    .eq("owner_id", ctx.ownerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const input = parsedBody.data;
  const nextStatus = input.status ?? tenant.status;
  let nextRoomId = input.roomId === undefined ? tenant.room_id : input.roomId;
  const nextAgreedRentAmount =
    input.agreedRentAmount === undefined
      ? tenant.agreed_rent_amount
      : input.agreedRentAmount;
  let nextJoinDate =
    input.joinDate === undefined ? tenant.join_date : input.joinDate;
  let nextMoveOutDate =
    input.moveOutDate === undefined ? tenant.move_out_date : input.moveOutDate;

  if (nextStatus === "active") {
    if (!nextRoomId) {
      return NextResponse.json(
        { error: "Assign a room before setting tenant status to active." },
        { status: 400 },
      );
    }
    if (!nextAgreedRentAmount || nextAgreedRentAmount <= 0) {
      return NextResponse.json(
        {
          error: "Add an agreed rent amount before setting tenant status to active.",
        },
        { status: 400 },
      );
    }
    if (!nextJoinDate) {
      nextJoinDate = todayDateString();
    }
    nextMoveOutDate = null;
  }

  if (nextStatus === "moved_out") {
    nextRoomId = null;
    if (!nextMoveOutDate) {
      nextMoveOutDate = todayDateString();
    }
  }

  if (nextStatus === "pending" || nextStatus === "rejected") {
    nextRoomId = null;
    nextMoveOutDate = null;
  }

  if (nextStatus !== "moved_out") {
    nextMoveOutDate = null;
  }

  if (nextRoomId) {
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("id, status")
      .eq("id", nextRoomId)
      .eq("hostel_id", tenant.hostel_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }

    if (!room) {
      return NextResponse.json(
        { error: "Selected room is not valid for this tenant's property." },
        { status: 400 },
      );
    }

    if (room.status === "inactive" || room.status === "maintenance") {
      return NextResponse.json(
        { error: "Selected room is not currently assignable." },
        { status: 400 },
      );
    }

    const { data: activeOccupant, error: occupantError } = await admin
      .from("tenants")
      .select("id")
      .eq("room_id", nextRoomId)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("id", tenant.id)
      .maybeSingle();

    if (occupantError) {
      return NextResponse.json({ error: occupantError.message }, { status: 500 });
    }

    if (activeOccupant) {
      return NextResponse.json(
        { error: "This room is already assigned to another active tenant." },
        { status: 409 },
      );
    }
  }

  const updatePayload: {
    full_name?: string;
    phone?: string | null;
    status: string;
    room_id: string | null;
    agreed_rent_amount: number | null;
    join_date: string | null;
    move_out_date: string | null;
    updated_at: string;
  } = {
    status: nextStatus,
    room_id: nextRoomId,
    agreed_rent_amount: nextAgreedRentAmount,
    join_date: nextJoinDate,
    move_out_date: nextMoveOutDate,
    updated_at: new Date().toISOString(),
  };

  if (input.fullName !== undefined) {
    updatePayload.full_name = input.fullName.trim();
  }

  if (input.phone !== undefined) {
    updatePayload.phone = input.phone ? input.phone : null;
  }

  const previousRoomId = tenant.room_id;

  const { error: updateError } = await admin
    .from("tenants")
    .update(updatePayload)
    .eq("id", tenant.id)
    .eq("owner_id", ctx.ownerId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (previousRoomId && previousRoomId !== nextRoomId) {
    const { count: remainingActiveTenants } = await admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", previousRoomId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (!remainingActiveTenants || remainingActiveTenants === 0) {
      await admin
        .from("rooms")
        .update({ status: "vacant", updated_at: new Date().toISOString() })
        .eq("id", previousRoomId);
    }
  }

  if (nextStatus === "active" && nextRoomId) {
    await admin
      .from("rooms")
      .update({ status: "occupied", updated_at: new Date().toISOString() })
      .eq("id", nextRoomId);
  }

  await admin.from("audit_logs").insert({
    owner_id: ctx.ownerId,
    user_id: ctx.userId,
    action: "UPDATE",
    table_name: "tenants",
    record_id: tenant.id,
    new_value: {
      full_name: updatePayload.full_name ?? tenant.full_name,
      phone: updatePayload.phone ?? tenant.phone,
      status: nextStatus,
      room_id: nextRoomId,
      agreed_rent_amount: nextAgreedRentAmount,
      join_date: nextJoinDate,
      move_out_date: nextMoveOutDate,
    },
  });

  const { data: updatedTenant, error: fetchError } = await admin
    .from("tenants")
    .select(
      "id, hostel_id, room_id, full_name, email, phone, status, agreed_rent_amount, join_date, move_out_date, created_at, updated_at",
    )
    .eq("id", tenant.id)
    .maybeSingle();

  if (fetchError || !updatedTenant) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, tenant: updatedTenant });
}
