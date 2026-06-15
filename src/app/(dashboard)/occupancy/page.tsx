import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  PropertyOccupancyAccordion,
  type OccupancyProperty,
} from "../../../components/occupancy/PropertyOccupancyAccordion";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

type RoomStatus =
  | "vacant"
  | "occupied"
  | "occupied_partial"
  | "maintenance"
  | "inactive";
type TenantStatus = "pending" | "active" | "moved_out" | "rejected";

type HostelRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

type FloorRow = {
  id: string;
  hostel_id: string;
  name: string;
};

type RoomRow = {
  id: string;
  hostel_id: string;
  floor_id: string;
  room_number: string;
  capacity: number;
  rent_amount: number | null;
  status: RoomStatus;
};

type TenantRow = {
  id: string;
  room_id: string | null;
  full_name: string;
  phone: string | null;
  status: TenantStatus;
  join_date: string | null;
  agreed_rent_amount: number | null;
};

export default async function OccupancyPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    console.error("[occupancy] failed to load owner", ownerError);
  }

  if (!owner) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Occupancy
          </h2>
          <p className="text-muted-foreground">
            Room and tenant allocation overview
          </p>
        </div>
        <Card className="rounded-2xl">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Owner account not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: hostels, error: hostelsError } = await admin
    .from("hostels")
    .select("id, name, city, state, is_active")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: true });

  if (hostelsError) {
    console.error("[occupancy] failed to load hostels", hostelsError);
  }

  const hostelRows = (hostels ?? []) as HostelRow[];
  const hostelIds = hostelRows.map((hostel) => hostel.id);

  if (hostelIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Occupancy
          </h2>
          <p className="text-muted-foreground">
            Room and tenant allocation overview
          </p>
        </div>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              Add your first property to start tracking room occupancy.
            </p>
            <Button asChild>
              <Link href="/hostels/new">Add Property</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
        "id, hostel_id, room_id, full_name, phone, status, join_date, agreed_rent_amount",
      )
      .eq("owner_id", owner.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (floorsError) {
    console.error("[occupancy] failed to load floors", floorsError);
  }
  if (roomsError) {
    console.error("[occupancy] failed to load rooms", roomsError);
  }
  if (tenantsError) {
    console.error("[occupancy] failed to load tenants", tenantsError);
  }

  const floorRows = (floors ?? []) as FloorRow[];
  const roomRows = (rooms ?? []) as RoomRow[];
  const tenantRows = (tenants ?? []) as TenantRow[];

  const floorsByHostel = new Map<string, FloorRow[]>();
  for (const floor of floorRows) {
    const current = floorsByHostel.get(floor.hostel_id) ?? [];
    current.push(floor);
    floorsByHostel.set(floor.hostel_id, current);
  }

  const roomsByFloor = new Map<string, RoomRow[]>();
  for (const room of roomRows) {
    const current = roomsByFloor.get(room.floor_id) ?? [];
    current.push(room);
    roomsByFloor.set(room.floor_id, current);
  }

  const tenantsByRoom = new Map<string, TenantRow[]>();
  for (const tenant of tenantRows) {
    if (!tenant.room_id) continue;
    const current = tenantsByRoom.get(tenant.room_id) ?? [];
    current.push(tenant);
    tenantsByRoom.set(tenant.room_id, current);
  }

  const properties: OccupancyProperty[] = hostelRows.map((hostel) => {
    const hostelFloors = floorsByHostel.get(hostel.id) ?? [];
    const mappedFloors = hostelFloors.map((floor) => {
      const floorRooms = roomsByFloor.get(floor.id) ?? [];
      const mappedRooms = floorRooms.map((room) => {
        const assignedTenants = tenantsByRoom.get(room.id) ?? [];
        const activeAssigned = assignedTenants.filter(
          (tenant) => tenant.status === "active",
        ).length;
        const occupiedCount = Math.min(activeAssigned, room.capacity);
        const availableCount = Math.max(room.capacity - occupiedCount, 0);

        return {
          id: room.id,
          roomNumber: room.room_number,
          capacity: room.capacity,
          rentAmount: room.rent_amount,
          status: room.status,
          occupiedCount,
          availableCount,
          assignedTenants,
        };
      });

      return {
        id: floor.id,
        name: floor.name,
        rooms: mappedRooms,
      };
    });

    const allRooms = mappedFloors.flatMap((floor) => floor.rooms);
    const totalBeds = allRooms
      .filter((room) => room.status !== "inactive")
      .reduce((sum, room) => sum + Number(room.capacity || 0), 0);
    const occupiedBeds = allRooms.reduce((sum, room) => sum + room.occupiedCount, 0);

    return {
      id: hostel.id,
      name: hostel.name,
      city: hostel.city,
      state: hostel.state,
      isActive: hostel.is_active,
      totalRooms: allRooms.length,
      totalBeds,
      occupiedBeds,
      vacantBeds: Math.max(totalBeds - occupiedBeds, 0),
      floors: mappedFloors,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Occupancy
        </h2>
        <p className="text-muted-foreground">
          Visual room allocation by property, floor, and tenant.
        </p>
      </div>

      <PropertyOccupancyAccordion properties={properties} />
    </div>
  );
}
