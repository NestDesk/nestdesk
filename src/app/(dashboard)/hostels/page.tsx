import {
  Building2,
  CheckCircle2,
  Home,
  Layers3,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { ActivatePropertyButton } from "../../../components/hostels/ActivatePropertyButton";
import { PropertyCardInvite } from "../../../components/hostels/PropertyCardInvite";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG",
  hostel: "Hostel",
  coliving: "Co-living",
  rental: "Rental",
};

type HostelRow = {
  id: string;
  name: string;
  property_type: "pg" | "hostel" | "coliving" | "rental";
  address: string;
  city: string;
  state: string;
  pincode: string;
  total_rooms: number;
  is_active: boolean;
  created_at: string;
  tenant_join_token: string | null;
  property_code: string | null;
};

type FloorOrRoomRow = {
  hostel_id: string;
};

export default async function PropertiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: owner } = user
    ? await supabase
        .from("owners")
        .select("phone_verified")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const isPhoneVerified = owner?.phone_verified ?? false;

  const { data: hostels, error } = await supabase
    .from("hostels")
    .select(
      "id, name, property_type, address, city, state, pincode, total_rooms, is_active, created_at, tenant_join_token, property_code",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Could not load properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error.message || "Something went wrong while fetching properties."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const properties = (hostels ?? []) as HostelRow[];
  const propertyIds = properties.map((property) => property.id);

  const [floorsResult, roomsResult] =
    propertyIds.length > 0
      ? await Promise.all([
          supabase
            .from("floors")
            .select("hostel_id")
            .in("hostel_id", propertyIds)
            .is("deleted_at", null),
          supabase
            .from("rooms")
            .select("hostel_id")
            .in("hostel_id", propertyIds)
            .is("deleted_at", null),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  const floorRows = (floorsResult.data ?? []) as FloorOrRoomRow[];
  const roomRows = (roomsResult.data ?? []) as FloorOrRoomRow[];

  const floorCountByHostel = new Map<string, number>();
  for (const row of floorRows) {
    floorCountByHostel.set(
      row.hostel_id,
      (floorCountByHostel.get(row.hostel_id) ?? 0) + 1,
    );
  }

  const roomCountByHostel = new Map<string, number>();
  for (const row of roomRows) {
    roomCountByHostel.set(
      row.hostel_id,
      (roomCountByHostel.get(row.hostel_id) ?? 0) + 1,
    );
  }

  const propertiesWithPlanState = properties.map((property) => {
    const floorCount = floorCountByHostel.get(property.id) ?? 0;
    const roomCount = roomCountByHostel.get(property.id) ?? 0;

    return {
      ...property,
      floorCount,
      roomCount,
      isFloorPlanComplete: floorCount > 0 && roomCount > 0,
    };
  });

  const totalProperties = propertiesWithPlanState.length;
  const activeProperties = propertiesWithPlanState.filter(
    (property) => property.is_active,
  ).length;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-blue-500/10">
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 bg-background/60 p-4">
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Total Properties</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {totalProperties}
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {activeProperties}
            </p>
          </div>

        </div>
      </div>

      {properties.length === 0 ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">No properties added yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Complete onboarding or add your first property to start managing rooms,
              tenants, and payments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {propertiesWithPlanState.map((property) => (
            <Card
              key={property.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border-border/70 bg-gradient-to-b from-background to-muted/20"
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1 text-base">
                    {property.name}
                  </CardTitle>
                  <Badge variant={property.is_active ? "default" : "secondary"}>
                    {property.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <Badge variant="outline" className="w-fit">
                  {PROPERTY_TYPE_LABELS[property.property_type] ?? "Property"}
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col text-sm text-muted-foreground">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Home className="h-3.5 w-3.5" />
                    <span>
                      Floor plan: {property.floorCount} floor(s),{" "}
                      {property.roomCount} room(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {property.isFloorPlanComplete ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Floor plan configured
                        </span>
                      </>
                    ) : (
                      <>
                        <Layers3 className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-amber-700 dark:text-amber-400">
                          Setup pending
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5" />
                    <p className="line-clamp-3">
                      {property.address}, {property.city}, {property.state}{" "}
                      {property.pincode}
                    </p>
                  </div>

                  {property.is_active ? (
                    property.tenant_join_token ? (
                      <PropertyCardInvite
                        joinToken={property.tenant_join_token}
                        propertyCode={property.property_code ?? undefined}
                        propertyName={property.name}
                      />
                    ) : null
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                      {property.isFloorPlanComplete ? (
                        <div className="space-y-2">
                          <p className="text-xs text-foreground/80">
                            Floor plan complete. You can activate this property now.
                          </p>
                          <ActivatePropertyButton
                            hostelId={property.id}
                            disabled={!isPhoneVerified}
                            disabledReason="Phone number not verified. Verify from My Profile to activate property."
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          At least one floor and rooms on that floor must be setup to
                          unlock property activation.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <Button asChild variant="default" className="w-full rounded-xl">
                    <Link href={`/hostels/${property.id}/setup`}>
                      Setup Floor Plan & Rooms
                   
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-col justify-end rounded-2xl border-0 bg-transparent p-0 md:min-h-full md:items-center md:justify-center md:gap-3 md:border md:border-dashed md:border-primary/35 md:bg-primary/[0.03] md:p-6 md:text-center">
            
            <Button asChild className="w-full rounded-xl md:w-auto">
              <Link href="/hostels/new">
                Add new property
               
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
