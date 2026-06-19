import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "../../../../../lib/supabase/server";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { PropertySetupManager } from "../../../../../components/hostels/PropertySetupManager";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function PropertySetupPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const propertyId = resolvedParams.id;

  const supabase = await createClient();

  const { data: property } = await supabase
    .from("hostels")
    .select(
      "id, name, property_type, is_active, tenant_join_token, property_code",
    )
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
      .select(
        "id, floor_id, room_number, capacity, rent_amount, status, created_at",
      )
      .eq("hostel_id", propertyId)
      .is("deleted_at", null),
  ]);

  const floors = floorsResult.data ?? [];
  const rooms = roomsResult.data ?? [];

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

  return (
    <div className="w-full space-y-2 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Setup Property
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            {property.name}
          </p>
        </div>
      </div>

      <PropertySetupManager
        hostelId={property.id}
        propertyName={property.name}
        isPhoneVerified={isPhoneVerified}
        isActive={property.is_active}
        tenantJoinToken={property.tenant_join_token}
        propertyCode={property.property_code}
        initialFloors={floors}
        initialRooms={rooms}
      />
    </div>
  );
}
