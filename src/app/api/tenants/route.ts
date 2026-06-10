import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getTenantProfileCompletion } from "../../../lib/tenant-profile-completion";

const TENANT_DOCS_BUCKET = "tenant-documents";

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

type OwnerContext = {
  ownerId: string;
};

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

  return { ownerId: owner.id };
}

// GET /api/tenants (owner)
export async function GET() {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const admin = createAdminClient();

  const { data: hostels, error: hostelsError } = await admin
    .from("hostels")
    .select("id, name, city, state")
    .eq("owner_id", ctx.ownerId)
    .order("created_at", { ascending: true });

  if (hostelsError) {
    return NextResponse.json({ error: hostelsError.message }, { status: 500 });
  }

  const hostelIds = (hostels ?? []).map((hostel) => hostel.id);

  if (hostelIds.length === 0) {
    return NextResponse.json({
      tenants: [],
      summary: {
        total: 0,
        pending: 0,
        active: 0,
        moved_out: 0,
        rejected: 0,
      },
      hostels: [],
      roomsByHostel: {},
    });
  }

  const { data: rooms, error: roomsError } = await admin
    .from("rooms")
    .select("id, hostel_id, room_number, status, capacity")
    .in("hostel_id", hostelIds)
    .is("deleted_at", null)
    .order("room_number", { ascending: true });

  if (roomsError) {
    return NextResponse.json({ error: roomsError.message }, { status: 500 });
  }

  const { data: tenants, error: tenantsError } = await admin
    .from("tenants")
    .select(
      "id, hostel_id, room_id, full_name, email, phone, occupation_type, institution_name, aadhar_last4, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, status, agreed_rent_amount, join_date, rent_start_date, move_out_date, created_at, updated_at, first_activated_at",
    )
    .eq("owner_id", ctx.ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (tenantsError) {
    return NextResponse.json({ error: tenantsError.message }, { status: 500 });
  }

  const hostelMap = new Map(
    (hostels ?? []).map((hostel) => [
      hostel.id,
      {
        name: hostel.name,
        location: [hostel.city, hostel.state].filter(Boolean).join(", "),
      },
    ]),
  );

  const roomMap = new Map((rooms ?? []).map((room) => [room.id, room]));

  // Count active tenants per room (only active tenants occupy beds)
  const occupancyPerRoom = new Map<string, number>();
  for (const tenant of tenants ?? []) {
    if (tenant.room_id && tenant.status === "active") {
      occupancyPerRoom.set(
        tenant.room_id,
        (occupancyPerRoom.get(tenant.room_id) ?? 0) + 1,
      );
    }
  }

  const roomsByHostel: Record<
    string,
    Array<{
      id: string;
      room_number: string;
      status: string;
      capacity: number;
      occupancy: number;
    }>
  > = {};

  for (const room of rooms ?? []) {
    if (!roomsByHostel[room.hostel_id]) {
      roomsByHostel[room.hostel_id] = [];
    }
    roomsByHostel[room.hostel_id].push({
      id: room.id,
      room_number: room.room_number,
      status: room.status,
      capacity: room.capacity,
      occupancy: occupancyPerRoom.get(room.id) ?? 0,
    });
  }

  const tenantRows = await Promise.all(
    (tenants ?? []).map(async (tenant) => {
      const hostel = hostelMap.get(tenant.hostel_id);
      const room = tenant.room_id ? roomMap.get(tenant.room_id) : null;
      const completion = getTenantProfileCompletion(tenant);
      const profilePhotoUrl = await createSignedUrl(
        tenant.profile_photo_path,
        admin,
      );

      return {
        id: tenant.id,
        hostel_id: tenant.hostel_id,
        hostel_name: hostel?.name ?? "Property",
        hostel_location: hostel?.location ?? null,
        room_id: tenant.room_id,
        room_number: room?.room_number ?? null,
        full_name: tenant.full_name,
        email: tenant.email,
        phone: tenant.phone,
        status: tenant.status,
        first_activated_at: tenant.first_activated_at,
        profile_photo_url: profilePhotoUrl,
        profile_completion_percentage: completion.percentage,
        agreed_rent_amount: tenant.agreed_rent_amount,
        join_date: tenant.join_date,
        rent_start_date: tenant.rent_start_date,
        move_out_date: tenant.move_out_date,
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
      };
    }),
  );

  const summary = tenantRows.reduce(
    (acc, tenant) => {
      acc.total += 1;
      if (tenant.status === "pending") acc.pending += 1;
      if (tenant.status === "active") acc.active += 1;
      if (tenant.status === "moved_out") acc.moved_out += 1;
      if (tenant.status === "rejected") acc.rejected += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      active: 0,
      moved_out: 0,
      rejected: 0,
    },
  );

  return NextResponse.json({
    tenants: tenantRows,
    summary,
    hostels: (hostels ?? []).map((hostel) => ({
      id: hostel.id,
      name: hostel.name,
      location: [hostel.city, hostel.state].filter(Boolean).join(", "),
    })),
    roomsByHostel,
  });
}
