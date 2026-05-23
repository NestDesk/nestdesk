import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PropertyDangerZone } from "@/components/hostels/PropertyDangerZone";
import { Building2, Settings } from "lucide-react";

type HostelRow = {
  id: string;
  name: string;
  property_type: string;
  is_active: boolean;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const ownerResult = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const ownerId = ownerResult.data?.id;

  const hostels = ownerId
    ? ((
        await admin
          .from("hostels")
          .select("id, name, property_type, is_active")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];

  const properties = hostels as HostelRow[];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your account, properties, and preferences.
          </p>
        </div>
      </div>

      <Separator />

      {/* Property Management section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Property Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Deactivate or permanently delete a property. Destructive actions cannot
            be undone.
          </p>
        </div>

        {properties.length === 0 ? (
          <Card className="rounded-2xl border-border/70">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                No properties found. Add a property first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {properties.map((property) => (
              <Card
                key={property.id}
                className="rounded-2xl border-border/70 bg-card/80"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {property.name}
                    </CardTitle>
                    <Badge variant={property.is_active ? "default" : "secondary"}>
                      {property.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <PropertyDangerZone
                    hostelId={property.id}
                    hostelName={property.name}
                    isActive={property.is_active}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
