import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertySetupManager } from "@/components/hostels/PropertySetupManager";
import { PropertyInviteCard } from "@/components/hostels/PropertyInviteCard";

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

  const floorStepDone = floors.length > 0;
  const roomStepDone = rooms.length > 0;

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
        initialFloors={floors}
        initialRooms={rooms}
      />

      {property.is_active && property.tenant_join_token ? (
        <PropertyInviteCard
          joinToken={property.tenant_join_token}
          propertyName={property.name}
          propertyCode={property.property_code ?? undefined}
        />
      ) : null}

      {!property.is_active && (!floorStepDone || !roomStepDone) ? (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-amber-600 dark:text-amber-400">
              Activation Reminder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              At least one floor and rooms on that floor must be setup to unlock
              property activation.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
