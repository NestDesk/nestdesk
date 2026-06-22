import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveUserAccountRole } from "../../lib/auth";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { DashboardShell } from "../../components/layout/DashboardShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  const roleState = await resolveUserAccountRole(user.id);
  if (roleState.role === "tenant") {
    redirect("/tenant/dashboard");
  }

  if (roleState.role === "unknown") {
    redirect("/onboarding");
  }

  // Check onboarding completion
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("onboarding_completed, phone_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
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
