import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getTenantProfileCompletion } from "../../../../lib/tenant-profile-completion";
import {
  isValidAadhaarNumber,
  normalizeAadhaarNumber,
} from "../../../../lib/aadhaar";
import { encryptAadhaar, hashAadhaar } from "../../../../lib/aadhaar-encryption";
import {
  getEffectivePlan,
  type OwnerPlan,
  type SubscriptionRecord,
} from "../../../../lib/subscriptions";
import { getPlanLimitsForOwner } from "../../../../lib/subscription-plans";

const TENANT_DOCS_BUCKET = "tenant-documents";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateTenantSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  aadharNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits.").optional(),
  occupationType: z.string().max(100).nullable().optional(),
  institutionName: z.string().max(200).nullable().optional(),
  phone: z
    .string()
    .regex(/^[\d]{10}$/, "Phone must be exactly 10 digits.")
    .or(z.literal(""))
    .optional(),
  status: z.enum(["pending", "active", "moved_out", "rejected"]).optional(),
  roomId: z.string().uuid().nullable().optional(),
  agreedRentAmount: z.number().positive().max(1000000).nullable().optional(),
  securityDeposit: z.number().positive().max(1000000).nullable().optional(),
  securityDepositReturned: z.number().min(0).max(1000000).nullable().optional(),
  joinDate: z.string().date().nullable().optional(),
  rentStartDate: z.string().date().nullable().optional(),
  moveOutDate: z.string().date().nullable().optional(),
});

const deleteTenantSchema = z.object({
  confirmationName: z.string().min(1),
});

type OwnerContext = {
  ownerId: string;
  userId: string;
  ownerPlan: OwnerPlan;
};

async function createSignedUrls(
  paths: Array<string | null>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path))),
  );
  const signedUrls = new Map<string, string>();

  if (uniquePaths.length === 0) {
    return signedUrls;
  }

  const { data, error } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 30);

  if (error || !data) {
    return signedUrls;
  }

  for (const entry of data) {
    if (entry.path && entry.signedUrl) {
      signedUrls.set(entry.path, entry.signedUrl);
    }
  }

  return signedUrls;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getRoomStatusFromActiveCount(
  activeCount: number,
  capacity: number,
): "vacant" | "occupied" | "occupied_partial" {
  if (activeCount <= 0) return "vacant";
  if (activeCount >= capacity) return "occupied";
  return "occupied_partial";
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
    .select("id, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  const { data: currentSubscription } = await admin
    .from("subscriptions")
    .select("plan, status, ends_at")
    .eq("owner_id", owner.id)
    .in("status", ["active", "grace_period"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRecord>();

  const effectiveOwnerPlan = getEffectivePlan(currentSubscription ?? null);

  return {
    ownerId: owner.id,
    userId: user.id,
    ownerPlan: effectiveOwnerPlan,
  };
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
      "id, owner_id, hostel_id, room_id, security_deposit, security_deposit_returned, full_name, email, phone, phone_verified, status, occupation_type, institution_name, govt_id_type, govt_id_last4, aadhar_last4, profile_photo_path, govt_id_front_path, govt_id_back_path, aadhar_front_path, aadhar_back_path, alternate_id_path, agreed_rent_amount, join_date, move_out_date, first_activated_at, created_at, updated_at, hostels(name, city, state), rooms(room_number)",
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
  // @ts-expect-error supabase nested select type
  const room = tenant.rooms as { room_number: string | null } | null;
  const completion = getTenantProfileCompletion(tenant);

  const signedUrls = await createSignedUrls(
    [
      tenant.profile_photo_path,
      tenant.govt_id_front_path,
      tenant.govt_id_back_path,
      tenant.aadhar_front_path,
      tenant.aadhar_back_path,
      tenant.alternate_id_path,
    ],
    admin,
  );
  const profilePhotoUrl = tenant.profile_photo_path
    ? signedUrls.get(tenant.profile_photo_path) ?? null
    : null;
  const govtFrontUrl = tenant.govt_id_front_path
    ? signedUrls.get(tenant.govt_id_front_path) ?? null
    : null;
  const govtBackUrl = tenant.govt_id_back_path
    ? signedUrls.get(tenant.govt_id_back_path) ?? null
    : null;
  const aadharFrontUrl = tenant.aadhar_front_path
    ? signedUrls.get(tenant.aadhar_front_path) ?? null
    : null;
  const aadharBackUrl = tenant.aadhar_back_path
    ? signedUrls.get(tenant.aadhar_back_path) ?? null
    : null;
  const alternateIdUrl = tenant.alternate_id_path
    ? signedUrls.get(tenant.alternate_id_path) ?? null
    : null;

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      hostel_id: tenant.hostel_id,
      hostel_name: hostel?.name ?? "Property",
      hostel_location:
        [hostel?.city, hostel?.state].filter(Boolean).join(", ") || null,
      room_id: tenant.room_id,
      room_number: room?.room_number ?? null,
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      phone_verified: tenant.phone_verified ?? false,
      status: tenant.status,
      occupation_type: tenant.occupation_type,
      institution_name: tenant.institution_name,
      govt_id_type: tenant.govt_id_type,
      govt_id_last4: tenant.govt_id_last4,
      aadhar_last4: tenant.aadhar_last4,
      profile_photo_url: profilePhotoUrl,
      govt_id_front_url: govtFrontUrl,
      govt_id_back_url: govtBackUrl,
      aadhar_front_url: aadharFrontUrl,
      aadhar_back_url: aadharBackUrl,
      alternate_id_url: alternateIdUrl,
      profile_completion_percentage: completion.percentage,
      profile_completion_missing: completion.missingFields,
      agreed_rent_amount: tenant.agreed_rent_amount,
      security_deposit: tenant.security_deposit,
      security_deposit_returned: tenant.security_deposit_returned,
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
      "id, owner_id, hostel_id, room_id, security_deposit, security_deposit_returned, status, agreed_rent_amount, join_date, rent_start_date, move_out_date, full_name, phone, email, occupation_type, institution_name, govt_id_type, govt_id_last4, govt_id_front_path, govt_id_back_path, aadhar_last4, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, first_activated_at",
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
  const normalizedAadhaar = input.aadharNumber
    ? normalizeAadhaarNumber(input.aadharNumber)
    : undefined;

  if (normalizedAadhaar && !isValidAadhaarNumber(normalizedAadhaar)) {
    return NextResponse.json({ error: "Invalid Aadhaar number." }, { status: 400 });
  }
  const nextStatus = input.status ?? tenant.status;
  let nextRoomId = input.roomId === undefined ? tenant.room_id : input.roomId;
  const nextAgreedRentAmount =
    input.agreedRentAmount === undefined
      ? tenant.agreed_rent_amount
      : input.agreedRentAmount;
  const nextSecurityDeposit =
    input.securityDeposit === undefined
      ? tenant.security_deposit
      : input.securityDeposit;
  const nextSecurityDepositReturned =
    input.securityDepositReturned === undefined
      ? tenant.security_deposit_returned
      : input.securityDepositReturned;
  let nextJoinDate =
    input.joinDate === undefined ? tenant.join_date : input.joinDate;
  const nextRentStartDate =
    input.rentStartDate === undefined
      ? (tenant.rent_start_date ?? tenant.join_date)
      : input.rentStartDate;
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

    if (tenant.status !== "active") {
      const planLimits = await getPlanLimitsForOwner(
        admin,
        ctx.ownerPlan,
        ctx.ownerId,
      );
      const { count: activeTenantCount, error: tenantCountError } = await admin
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ctx.ownerId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (tenantCountError) {
        return NextResponse.json(
          { error: tenantCountError.message },
          { status: 500 },
        );
      }

      if ((activeTenantCount ?? 0) >= planLimits.maxTenants) {
        return NextResponse.json(
          {
            error: `Your current plan allows up to ${planLimits.maxTenants} active tenants. Upgrade your plan to activate more tenants.`,
          },
          { status: 403 },
        );
      }
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
      return NextResponse.json(
        {
          error: "Move-out date is required when moving out.",
        },
        { status: 400 },
      );
    }
    if (nextJoinDate && nextMoveOutDate && nextMoveOutDate < nextJoinDate) {
      return NextResponse.json(
        {
          error: "Move-out date cannot be earlier than join date.",
        },
        { status: 400 },
      );
    }
  }

  let nextRoomCapacity = 0;
  let nextRoomOccupantCount = 0;

  if (nextRoomId) {
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("id, status, capacity")
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

    // Count active tenants in this room (excluding current tenant)
    const { count: activeOccupantCount, error: occupantError } = await admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", nextRoomId)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("id", tenant.id);

    if (occupantError) {
      return NextResponse.json({ error: occupantError.message }, { status: 500 });
    }

    // Check if room has available capacity
    if (activeOccupantCount && activeOccupantCount >= room.capacity) {
      return NextResponse.json(
        { error: "This room is at full capacity. No beds available." },
        { status: 409 },
      );
    }

    nextRoomCapacity = room.capacity;
    nextRoomOccupantCount = (activeOccupantCount ?? 0) + 1;
  }

  const updatePayload: {
    full_name?: string;
    occupation_type?: string | null;
    institution_name?: string | null;
    aadhar_number?: string;
    aadhar_number_hash?: string;
    aadhar_last4?: string;
    phone?: string | null;
    status: string;
    room_id: string | null;
    agreed_rent_amount: number | null;
    security_deposit: number | null;
    security_deposit_returned: number | null;
    join_date: string | null;
    rent_start_date: string | null;
    move_out_date: string | null;
    first_activated_at: string | null;
    updated_at: string;
  } = {
    status: nextStatus,
    room_id: nextRoomId,
    agreed_rent_amount: nextAgreedRentAmount,
    security_deposit: nextSecurityDeposit,
    security_deposit_returned: nextSecurityDepositReturned,
    join_date: nextJoinDate,
    rent_start_date: nextRentStartDate,
    move_out_date: nextMoveOutDate,
    first_activated_at: nextFirstActivatedAt,
    updated_at: new Date().toISOString(),
  };

  if (input.fullName !== undefined) {
    updatePayload.full_name = input.fullName.trim();
  }

  if (input.occupationType !== undefined) {
    updatePayload.occupation_type = input.occupationType?.trim() || null;
  }

  if (input.institutionName !== undefined) {
    updatePayload.institution_name = input.institutionName?.trim() || null;
  }

  if (normalizedAadhaar) {
    updatePayload.aadhar_number = encryptAadhaar(normalizedAadhaar);
    updatePayload.aadhar_number_hash = hashAadhaar(normalizedAadhaar);
    updatePayload.aadhar_last4 = normalizedAadhaar.slice(-4);
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
    if (
      updateError.message
        .toLowerCase()
        .includes("aadhar_number_hash")
    ) {
      return NextResponse.json(
        { error: "This Aadhaar number is already linked to another tenant." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (previousRoomId && previousRoomId !== nextRoomId) {
    const { count: remainingActiveTenants, error: remainingError } = await admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", previousRoomId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (remainingError) {
      return NextResponse.json({ error: remainingError.message }, { status: 500 });
    }

    const { data: previousRoom, error: previousRoomError } = await admin
      .from("rooms")
      .select("capacity, status")
      .eq("id", previousRoomId)
      .maybeSingle();

    if (previousRoomError) {
      return NextResponse.json(
        { error: previousRoomError.message },
        { status: 500 },
      );
    }

    const previousRoomStatus =
      previousRoom?.status === "inactive" || previousRoom?.status === "maintenance"
        ? previousRoom.status
        : getRoomStatusFromActiveCount(
            remainingActiveTenants ?? 0,
            previousRoom?.capacity ?? 1,
          );

    await admin
      .from("rooms")
      .update({ status: previousRoomStatus, updated_at: new Date().toISOString() })
      .eq("id", previousRoomId);
  }

  if (nextStatus === "active" && nextRoomId) {
    const nextRoomStatus = getRoomStatusFromActiveCount(
      nextRoomOccupantCount,
      nextRoomCapacity || 1,
    );

    await admin
      .from("rooms")
      .update({ status: nextRoomStatus, updated_at: new Date().toISOString() })
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
      occupation_type: updatePayload.occupation_type ?? tenant.occupation_type,
      institution_name:
        updatePayload.institution_name ?? tenant.institution_name,
      aadhar_last4: updatePayload.aadhar_last4 ?? tenant.aadhar_last4,
      phone: updatePayload.phone ?? tenant.phone,
      status: nextStatus,
      room_id: nextRoomId,
      agreed_rent_amount: nextAgreedRentAmount,
      security_deposit: nextSecurityDeposit,
      security_deposit_returned: nextSecurityDepositReturned,
      join_date: nextJoinDate,
      rent_start_date: nextRentStartDate,
      move_out_date: nextMoveOutDate,
      first_activated_at: nextFirstActivatedAt,
    },
  });

  const { data: updatedTenant, error: fetchError } = await admin
    .from("tenants")
    .select(
      "id, hostel_id, room_id, full_name, email, phone, status, agreed_rent_amount, security_deposit, security_deposit_returned, join_date, rent_start_date, move_out_date, first_activated_at, created_at, updated_at",
    )
    .eq("id", tenant.id)
    .maybeSingle();

  if (fetchError || !updatedTenant) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, tenant: updatedTenant });
}

export async function DELETE(
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
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }

  const parsedBody = deleteTenantSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }

  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(
      "id, auth_user_id, hostel_id, room_id, full_name, profile_photo_path, aadhar_doc_path, aadhar_front_path, aadhar_back_path, alternate_id_path",
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

  if (parsedBody.data.confirmationName !== tenant.full_name) {
    return NextResponse.json(
      { error: "The tenant name does not match exactly." },
      { status: 400 },
    );
  }

  const { error: paymentsError } = await admin
    .from("payments")
    .delete()
    .eq("tenant_id", tenant.id);
  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  }

  const { error: invoicesError } = await admin
    .from("invoices")
    .delete()
    .eq("tenant_id", tenant.id);
  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 });
  }

  const documentPaths = [
    tenant.profile_photo_path,
    tenant.aadhar_doc_path,
    tenant.aadhar_front_path,
    tenant.aadhar_back_path,
    tenant.alternate_id_path,
  ].filter((path): path is string => Boolean(path));
  if (documentPaths.length > 0) {
    await admin.storage.from(TENANT_DOCS_BUCKET).remove(documentPaths);
  }

  const { error: deleteTenantError } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenant.id)
    .eq("owner_id", ctx.ownerId);
  if (deleteTenantError) {
    return NextResponse.json({ error: deleteTenantError.message }, { status: 500 });
  }

  if (tenant.auth_user_id) {
    const { error: deleteAuthUserError } = await admin.auth.admin.deleteUser(
      tenant.auth_user_id,
    );
    if (deleteAuthUserError) {
      return NextResponse.json(
        {
          error:
            "Tenant data was deleted, but the tenant login could not be removed. Contact support.",
        },
        { status: 500 },
      );
    }
  }

  await admin.from("audit_logs").insert({
    owner_id: ctx.ownerId,
    user_id: ctx.userId,
    action: "DELETE",
    table_name: "tenants",
    record_id: tenant.id,
    old_value: { full_name: tenant.full_name },
  });

  return NextResponse.json({ success: true });
}
