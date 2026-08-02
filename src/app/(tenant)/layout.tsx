import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveUserAccountRole } from "../../lib/auth";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { TenantShell } from "../../components/layout/TenantShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const roleState = await resolveUserAccountRole(user.id);
  if (roleState.role === "owner") {
    redirect("/dashboard");
  }

  if (roleState.role === "unknown") {
    redirect("/onboarding");
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, full_name, status, hostel_id, email, phone, occupation_type, institution_name, aadhar_last4, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, hostels(name, address, city, state, pincode, property_type)",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    redirect("/onboarding");
  }

  return <TenantShell tenantName={tenant.full_name}>{children}</TenantShell>;
}
