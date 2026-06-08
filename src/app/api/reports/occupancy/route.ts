import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type OccupancyTenant = {
  id: string;
  hostel_id: string;
  room_id: string | null;
  full_name: string;
  status: string;
  rent_start_date: string | null;
  moved_out_at: string | null;
};
type RoomRecord = {
  id: string;
  hostel_id: string;
  room_number: string;
  capacity: number | string | null;
  status: string;
};

async function getOwnerCtx() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owner) return null;
  const { data: hostels } = await admin
    .from("hostels")
    .select("id, name")
    .eq("owner_id", owner.id);
  return {
    ownerId: owner.id,
    hostels: hostels ?? [],
    hostelIds: (hostels ?? []).map((h) => h.id),
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getOwnerCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const hostelParam = url.searchParams.get("hostelIds");
  const admin = createAdminClient();

  const hostelNameMap = new Map(ctx.hostels.map((h) => [h.id, h.name]));
  const scopedIds = hostelParam
    ? hostelParam.split(",").filter((id) => ctx.hostelIds.includes(id))
    : ctx.hostelIds;

  if (!scopedIds.length) {
    return NextResponse.json({
      data: {
        kpis: {
          totalBeds: 0,
          occupiedBeds: 0,
          vacancyRate: 0,
          newMoveIns: 0,
          moveOuts: 0,
        },
        chart: [],
        table: [],
      },
    });
  }

  // rooms
  const { data: rooms } = (await admin
    .from("rooms")
    .select("id, hostel_id, room_number, capacity, status")
    .in("hostel_id", scopedIds)
    .is("deleted_at", null)) as SupabaseResponse<RoomRecord[]>;

  // tenants
  const { data: allTenants } = (await admin
    .from("tenants")
    .select(
      "id, hostel_id, room_id, full_name, status, rent_start_date, moved_out_at",
    )
    .in("hostel_id", scopedIds)) as SupabaseResponse<OccupancyTenant[]>;

  const tenants = (allTenants ?? []).filter((t) => t.status !== "rejected");

  const activeTenants = tenants.filter((t) => t.status === "active");
  const now = new Date();

  // new move-ins in date range
  const moveInStart = startDate ?? "1970-01-01";
  const moveInEnd = endDate ?? now.toISOString().slice(0, 10);
  const newMoveIns = tenants.filter((t) => {
    const d = t.rent_start_date;
    return d && d >= moveInStart && d <= moveInEnd;
  }).length;

  const moveOuts = tenants.filter((t) => {
    const d = t.moved_out_at;
    return d && d >= moveInStart && d <= moveInEnd;
  }).length;

  // avg stay
  const stays = tenants
    .filter((t) => t.rent_start_date)
    .map((t) => {
      const start = new Date(t.rent_start_date!);
      const end = t.moved_out_at ? new Date(t.moved_out_at) : now;
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    });
  const avgStay = stays.length
    ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length)
    : 0;

  // bed counts
  const totalBeds = (rooms ?? []).reduce((s, r) => s + Number(r.capacity), 0);
  const occupiedBeds = activeTenants.length;
  const vacancyRate =
    totalBeds > 0 ? Math.round(((totalBeds - occupiedBeds) / totalBeds) * 100) : 0;

  function getRoomOccupancyState(
    status: string,
    activeCount: number,
    capacity: number,
  ) {
    if (status === "inactive") return "inactive";
    if (status === "maintenance") return "maintenance";
    if (activeCount <= 0) return "vacant";
    if (activeCount >= capacity) return "occupied_full";
    return "occupied_partial";
  }

  const tenantCountByRoom = new Map<string, number>();
  for (const tenant of activeTenants) {
    if (!tenant.room_id) continue;
    tenantCountByRoom.set(
      tenant.room_id,
      (tenantCountByRoom.get(tenant.room_id) ?? 0) + 1,
    );
  }

  // per-property chart with room status breakdown
  const chart = scopedIds.map((hid) => {
    const hRooms = (rooms ?? []).filter((r) => r.hostel_id === hid);
    let totalRooms = 0;
    let occupiedFullRooms = 0;
    let occupiedPartialRooms = 0;
    let inactiveRooms = 0;
    let maintenanceRooms = 0;
    let vacantRooms = 0;

    for (const room of hRooms) {
      totalRooms += 1;
      const activeInRoom = tenantCountByRoom.get(room.id) ?? 0;
      const roomState = getRoomOccupancyState(
        room.status,
        activeInRoom,
        Number(room.capacity) || 0,
      );

      if (roomState === "inactive") {
        inactiveRooms += 1;
      } else if (roomState === "maintenance") {
        maintenanceRooms += 1;
      } else if (roomState === "occupied_full") {
        occupiedFullRooms += 1;
      } else if (roomState === "occupied_partial") {
        occupiedPartialRooms += 1;
      } else {
        vacantRooms += 1;
      }
    }

    return {
      property: hostelNameMap.get(hid) ?? hid,
      totalRooms,
      occupiedFullRooms,
      occupiedPartialRooms,
      inactiveRooms,
      maintenanceRooms,
      vacantRooms,
    };
  });

  // table: one row per room
  const activeByRoom = new Map<string, number>();
  for (const t of activeTenants)
    if (t.room_id)
      activeByRoom.set(t.room_id, (activeByRoom.get(t.room_id) ?? 0) + 1);
  const table = (rooms ?? []).map((r) => {
    const activeCount = activeByRoom.get(r.id) ?? 0;
    const roomState = getRoomOccupancyState(
      r.status,
      activeCount,
      Number(r.capacity) || 0,
    );

    return {
      id: r.id,
      room_number: r.room_number,
      hostel_name: hostelNameMap.get(r.hostel_id) ?? "—",
      capacity: Number(r.capacity),
      occupied: activeCount,
      vacant: Math.max(0, Number(r.capacity) - activeCount),
      status: roomState,
    };
  });

  return NextResponse.json({
    data: {
      kpis: {
        totalBeds,
        occupiedBeds,
        vacancyRate,
        newMoveIns,
        moveOuts,
        avgStayDays: avgStay,
      },
      chart,
      table,
    },
  });
}
