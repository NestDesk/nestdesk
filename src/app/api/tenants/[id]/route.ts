import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantProfileCompletion } from "@/lib/tenant-profile-completion";

const TENANT_DOCS_BUCKET = "tenant-documents";

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

async function createSignedUrl(
  path: string | null,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tenant id." }, { status: 400 });
  }

  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(
      "id, owner_id, hostel_id, room_id, full_name, email, phone, status, occupation_type, institution_name, aadhar_number, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, agreed_rent_amount, join_date, move_out_date, first_activated_at, created_at, updated_at, hostels(name, city, state)",
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

  // @ts-expect-error supabase nested select type
  const hostel = tenant.hostels as {
    name: string;
    city: string;
    state: string;
  } | null;
  const completion = getTenantProfileCompletion(tenant);

  const [profilePhotoUrl, aadharFrontUrl, aadharBackUrl, alternateIdUrl] =
    await Promise.all([
      createSignedUrl(tenant.profile_photo_path, admin),
      createSignedUrl(tenant.aadhar_front_path, admin),
      createSignedUrl(tenant.aadhar_back_path, admin),
      createSignedUrl(tenant.alternate_id_path, admin),
    ]);

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      hostel_id: tenant.hostel_id,
      hostel_name: hostel?.name ?? "Property",
      hostel_location:
        [hostel?.city, hostel?.state].filter(Boolean).join(", ") || null,
      room_id: tenant.room_id,
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
      occupation_type: tenant.occupation_type,
      institution_name: tenant.institution_name,
      aadhar_number: tenant.aadhar_number,
      profile_photo_url: profilePhotoUrl,
      aadhar_front_url: aadharFrontUrl,
      aadhar_back_url: aadharBackUrl,
      alternate_id_url: alternateIdUrl,
      profile_completion_percentage: completion.percentage,
      profile_completion_missing: completion.missingFields,
      agreed_rent_amount: tenant.agreed_rent_amount,
      join_date: tenant.join_date,
      move_out_date: tenant.move_out_date,
      first_activated_at: tenant.first_activated_at,
      created_at: tenant.created_at,
      updated_at: tenant.updated_at,
    },
  });
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
      "id, owner_id, hostel_id, room_id, status, agreed_rent_amount, join_date, move_out_date, full_name, phone, email, occupation_type, institution_name, aadhar_number, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, first_activated_at",
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
  let nextFirstActivatedAt = tenant.first_activated_at;

  if (nextStatus === "active") {
    const completion = getTenantProfileCompletion({
      ...tenant,
      full_name:
        input.fullName !== undefined ? input.fullName.trim() : tenant.full_name,
      phone: input.phone !== undefined ? input.phone || null : tenant.phone,
    });
    if (completion.percentage < 100) {
      return NextResponse.json(
        {
          error:
            "Tenant profile must be 100% complete before activation. Ask tenant to complete all required profile and ID uploads.",
        },
        { status: 400 },
      );
    }

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
    if (!nextFirstActivatedAt) {
      nextFirstActivatedAt = new Date().toISOString();
    }
    nextMoveOutDate = null;
  }

  if (nextStatus === "moved_out") {
    if (!tenant.first_activated_at && tenant.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Moved out is allowed only for tenants that were activated earlier.",
        },
        { status: 400 },
      );
    }
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
    first_activated_at: string | null;
    updated_at: string;
  } = {
    status: nextStatus,
    room_id: nextRoomId,
    agreed_rent_amount: nextAgreedRentAmount,
    join_date: nextJoinDate,
    move_out_date: nextMoveOutDate,
    first_activated_at: nextFirstActivatedAt,
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
      first_activated_at: nextFirstActivatedAt,
    },
  });

  const { data: updatedTenant, error: fetchError } = await admin
    .from("tenants")
    .select(
      "id, hostel_id, room_id, full_name, email, phone, status, agreed_rent_amount, join_date, move_out_date, first_activated_at, created_at, updated_at",
    )
    .eq("id", tenant.id)
    .maybeSingle();

  if (fetchError || !updatedTenant) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, tenant: updatedTenant });
}
