import { Building2, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import { OwnerProfileCard } from "../../../components/profile/OwnerProfileCard";

type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  onboarding_completed: boolean;
  created_at: string;
};

function formatDate(value: string | null) {
  return formatDateInIndia(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildAddress(owner: OwnerProfile | null) {
  if (!owner) return "-";
  const line1 = owner.address_line1?.trim() ?? "";
  const line2 = owner.address_line2?.trim() ?? "";
  const landmark = owner.landmark?.trim() ?? "";
  const city = owner.city?.trim() ?? "";
  const state = owner.state?.trim() ?? "";
  const pincode = owner.pincode?.trim() ?? "";

  const top = [line1, line2].filter(Boolean).join(", ");
  const bottom = [landmark, city, state, pincode].filter(Boolean).join(", ");
  return [top, bottom].filter(Boolean).join("\n") || "-";
}

export default async function OwnerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select(
      "id, full_name, phone, phone_verified, phone_verified_at, address_line1, address_line2, landmark, city, state, pincode, onboarding_completed, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle<OwnerProfile>();

  const { count: propertyCount } = owner
    ? await admin
        .from("hostels")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", owner.id)
    : { count: 0 };

  const { count: activePropertyCount } = owner
    ? await admin
        .from("hostels")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", owner.id)
        .eq("is_active", true)
    : { count: 0 };

  const displayName =
    owner?.full_name?.trim() || user.user_metadata?.full_name || "Owner";
  const addressText = buildAddress(owner ?? null);
  const phoneDigits = String(owner?.phone ?? "")
    .replace(/\D/g, "")
    .slice(-10);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            My Profile
          </h2>
          <p className="text-sm text-muted-foreground">
            Owner account details and business profile information.
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-3">
        <OwnerProfileCard
          initial={{
            fullName: String(displayName),
            phone: phoneDigits,
            addressLine1: owner?.address_line1 ?? "",
            addressLine2: owner?.address_line2 ?? "",
            landmark: owner?.landmark ?? "",
            city: owner?.city ?? "",
            state: owner?.state ?? "",
            pincode: owner?.pincode ?? "",
          }}
          displayValues={{
            email: user.email ?? null,
            onboardingCompleted: owner?.onboarding_completed ?? false,
            phoneVerified: owner?.phone_verified ?? false,
            phoneVerifiedAt: owner?.phone_verified_at ?? null,
            addressText,
          }}
        />

        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Properties
              </p>
              <p className="text-lg font-semibold text-foreground">
                {propertyCount ?? 0}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Active Properties</p>
              <p className="text-lg font-semibold text-foreground">
                {activePropertyCount ?? 0}
              </p>
            </div>

            <div>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Member Since
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(owner?.created_at ?? null)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
