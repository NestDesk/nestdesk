import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { Separator } from "../../../components/ui/separator";
import { SettingsClient } from "../../../components/settings/SettingsClient";

type HostelRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
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
          .select(
            "id, name, address, city, state, pincode, property_type, is_active",
          )
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];

  const properties = hostels as HostelRow[];

  return (
    <div className="space-y-2">
      <Separator />

      {/* Business Settings - All management sections */}
      <div className="space-y-4">
        <SettingsClient properties={properties} />
      </div>
    </div>
  );
}
