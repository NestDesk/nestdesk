import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropertySetupManager } from "@/components/hostels/PropertySetupManager";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function PropertySetupPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const propertyId = resolvedParams.id;

  const supabase = await createClient();

  const { data: property } = await supabase
    .from("hostels")
    .select("id, name, property_type, is_active, tenant_join_token, property_code")
    .eq("id", propertyId)
    .single();

  if (!property) {
    notFound();
  }

  const [floorsResult, roomsResult] = await Promise.all([
    supabase
      .from("floors")
      .select("id, name, created_at")
      .eq("hostel_id", propertyId)
      .is("deleted_at", null),
    supabase
      .from("rooms")
      .select("id, floor_id, room_number, capacity, rent_amount, status, created_at")
      .eq("hostel_id", propertyId)
      .is("deleted_at", null),
  ]);

  const floors = floorsResult.data ?? [];
  const rooms = roomsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Setup Property
          </h2>
          <p className="text-muted-foreground">{property.name}</p>
        </div>

        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/hostels">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Properties
          </Link>
        </Button>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-muted-foreground">
          <Badge variant={property.is_active ? "default" : "secondary"}>
            {property.is_active ? "Active" : "Inactive"}
          </Badge>
          <span>Property type: {property.property_type}</span>
          <span>Floors: {floors.length}</span>
          <span>Rooms: {rooms.length}</span>
        </CardContent>
      </Card>

      <PropertySetupManager
        hostelId={property.id}
        propertyName={property.name}
        isActive={property.is_active}
        tenantJoinToken={property.tenant_join_token}
        propertyCode={property.property_code}
        initialFloors={floors}
        initialRooms={rooms}
      />
    </div>
  );
}
