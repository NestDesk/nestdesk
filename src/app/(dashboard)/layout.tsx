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
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  if (!owner?.onboarding_completed) {
    redirect("/onboarding");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
