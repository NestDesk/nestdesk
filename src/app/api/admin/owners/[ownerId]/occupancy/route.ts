import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: { ownerId: string } }
) {
  try {
    const ownerId = params.ownerId;
    const admin = createAdminClient();

    const { data: hostels, error: hostelsError } = await admin
      .from("hostels")
      .select("id, name, city, state, is_active")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true });

    if (hostelsError) throw hostelsError;

    const hostelRows = (hostels ?? []);
    const hostelIds = hostelRows.map((h) => h.id);

    if (hostelIds.length === 0) {
      return NextResponse.json({ properties: [] });
    }

    const [
      { data: floors, error: floorsError },
      { data: rooms, error: roomsError },
      { data: tenants, error: tenantsError },
    ] = await Promise.all([
      admin
        .from("floors")
        .select("id, hostel_id, name")
        .in("hostel_id", hostelIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      admin
        .from("rooms")
        .select("id, hostel_id, floor_id, room_number, capacity, rent_amount, status")
        .in("hostel_id", hostelIds)
        .is("deleted_at", null)
        .order("room_number", { ascending: true }),
      admin
        .from("tenants")
        .select(
          "id, hostel_id, room_id, full_name, phone, status, join_date, agreed_rent_amount"
        )
        .eq("owner_id", ownerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    if (floorsError) throw floorsError;
    if (roomsError) throw roomsError;
    if (tenantsError) throw tenantsError;

    const floorRows = (floors ?? []);
    const roomRows = (rooms ?? []);
    const tenantRows = (tenants ?? []);

    const floorsByHostel = new Map<string, typeof floorRows>();
    for (const floor of floorRows) {
      const current = floorsByHostel.get(floor.hostel_id) ?? [];
      current.push(floor);
      floorsByHostel.set(floor.hostel_id, current);
    }

    const roomsByFloor = new Map<string, typeof roomRows>();
    for (const room of roomRows) {
      const current = roomsByFloor.get(room.floor_id) ?? [];
      current.push(room);
      roomsByFloor.set(room.floor_id, current);
    }

    const tenantsByRoom = new Map<string, typeof tenantRows>();
    for (const tenant of tenantRows) {
      if (!tenant.room_id) continue;
      const current = tenantsByRoom.get(tenant.room_id) ?? [];
      current.push(tenant);
      tenantsByRoom.set(tenant.room_id, current);
    }

    const properties = hostelRows.map((hostel) => {
      const hostelFloors = floorsByHostel.get(hostel.id) ?? [];
      const mappedFloors = hostelFloors.map((floor) => {
        const floorRooms = roomsByFloor.get(floor.id) ?? [];
        const mappedRooms = floorRooms.map((room) => {
          const roomTenants = tenantsByRoom.get(room.id) ?? [];
          return {
            id: room.id,
            roomNumber: room.room_number,
            capacity: room.capacity,
            rentAmount: room.rent_amount,
            status: room.status,
            occupiedCount: roomTenants.length,
            availableCount: Math.max(0, room.capacity - roomTenants.length),
            assignedTenants: roomTenants.map((t) => ({
              id: t.id,
              full_name: t.full_name,
              phone: t.phone,
              status: t.status,
              join_date: t.join_date,
              agreed_rent_amount: t.agreed_rent_amount,
            })),
          };
        });
        return {
          id: floor.id,
          name: floor.name,
          rooms: mappedRooms,
        };
      });
      return {
        id: hostel.id,
        name: hostel.name,
        city: hostel.city,
        state: hostel.state,
        isActive: hostel.is_active,
        floors: mappedFloors,
      };
    });

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("[api/admin/owners/occupancy] error:", error);
    return NextResponse.json({ error: "Failed to load occupancy" }, { status: 500 });
  }
}
