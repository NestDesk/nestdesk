import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TenantNoticesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, hostel_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!tenant) redirect("/login");

  const { data: notices } = await admin
    .from("notices")
    .select("id, title, body, created_at")
    .eq("hostel_id", tenant.hostel_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = notices ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Notices
        </h1>
        <p className="text-muted-foreground">
          Announcements and notices from your property.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No notices yet.</p>
          <p className="text-xs text-muted-foreground">
            Notices posted by your property owner will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((n) => (
            <Card key={n.id} className="rounded-2xl border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {n.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
