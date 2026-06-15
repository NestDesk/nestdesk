import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { AdminShell } from "../../components/admin/AdminShell";

export const dynamic = "force-dynamic";

const COMPANY_ADMIN_EMAIL = "support@nestdesk.in";

export default async function AdminLayout({
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

  if (user.email !== COMPANY_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
