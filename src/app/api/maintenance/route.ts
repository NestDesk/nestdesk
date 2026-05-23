import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OwnerContext = {
  ownerId: string;
  hostelMap: Map<string, { name: string; city: string; state: string }>;
  hostelIds: string[];
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
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  const { data: hostels } = await admin
    .from("hostels")
    .select("id, name, city, state")
    .eq("owner_id", owner.id)
    .is("deleted_at", null);

  const hostelMap = new Map<string, { name: string; city: string; state: string }>();
  for (const row of hostels ?? []) {
    hostelMap.set(row.id, {
      name: row.name,
      city: row.city,
      state: row.state,
    });
  }

  return {
    ownerId: owner.id,
    hostelIds: Array.from(hostelMap.keys()),
    hostelMap,
  };
}

// GET /api/maintenance (owner)
export async function GET() {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({ requests: [], openCount: 0 });
  }

  const admin = createAdminClient();
  const { data: requests, error } = await admin
    .from("maintenance_requests")
    .select(
      "id, hostel_id, tenant_id, room_id, title, description, status, created_at, updated_at",
    )
    .in("hostel_id", ctx.hostelIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = requests ?? [];

  const tenantIds = Array.from(
    new Set(rows.map((r) => r.tenant_id).filter((v): v is string => !!v)),
  );

  const { data: tenants } = tenantIds.length
    ? await admin
        .from("tenants")
        .select("id, full_name, room_id, rooms(room_number)")
        .in("id", tenantIds)
    : {
        data: [] as Array<{ id: string; full_name: string; room_id: string | null }>,
      };

  const tenantMap = new Map<
    string,
    { fullName: string; roomNumber: string | null }
  >();
  for (const tenant of tenants ?? []) {
    // @ts-expect-error nested select type from supabase
    const room = tenant.rooms as { room_number: string } | null;
    tenantMap.set(tenant.id, {
      fullName: tenant.full_name,
      roomNumber: room?.room_number ?? null,
    });
  }

  const requestIds = rows.map((r) => r.id);
  const { data: comments } = requestIds.length
    ? await admin
        .from("maintenance_request_comments")
        .select("id, maintenance_request_id, comment, created_at")
        .in("maintenance_request_id", requestIds)
        .order("created_at", { ascending: true })
    : {
        data: [] as Array<{
          id: string;
          maintenance_request_id: string;
          comment: string;
          created_at: string;
        }>,
      };

  const commentsByRequest = new Map<
    string,
    Array<{ id: string; comment: string; created_at: string }>
  >();

  for (const c of comments ?? []) {
    const current = commentsByRequest.get(c.maintenance_request_id) ?? [];
    current.push({ id: c.id, comment: c.comment, created_at: c.created_at });
    commentsByRequest.set(c.maintenance_request_id, current);
  }

  const responseRows = rows.map((request) => {
    const hostel = ctx.hostelMap.get(request.hostel_id);
    const tenant = request.tenant_id ? tenantMap.get(request.tenant_id) : null;

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status,
      created_at: request.created_at,
      updated_at: request.updated_at,
      hostel_id: request.hostel_id,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
      tenant_id: request.tenant_id,
      tenant_name: tenant?.fullName ?? "Unknown tenant",
      room_number: tenant?.roomNumber ?? null,
      owner_comments: commentsByRequest.get(request.id) ?? [],
    };
  });

  const openCount = responseRows.filter((r) => r.status === "open").length;
  return NextResponse.json({ requests: responseRows, openCount });
}
