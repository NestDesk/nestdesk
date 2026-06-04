import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
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

  // Check onboarding completion
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed, phone_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (tenant) {
      redirect("/tenant/dashboard");
    }

    redirect("/onboarding");
  }

  if (!owner.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <DashboardShell isPhoneVerified={owner.phone_verified}>
      {children}
    </DashboardShell>
  );
}
