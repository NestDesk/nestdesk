import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { BadgeCheck, Building2, LogOut, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TenantNav } from "@/components/layout/TenantNav";

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

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, full_name, status, hostel_id, hostels(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    // Not a tenant account — redirect to owner dashboard or login
    redirect("/dashboard");
  }

  const hostelName =
    // @ts-expect-error supabase nested select type
    (tenant.hostels as { name: string } | null)?.name ?? "Your Property";

  const statusLabel =
    tenant.status === "active"
      ? "Active"
      : tenant.status === "rejected"
        ? "Rejected"
        : tenant.status === "moved_out"
          ? "Moved Out"
          : "Pending Approval";

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.1),transparent_40%)]" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/tenant/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-500 shadow shadow-primary/30">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none text-foreground">
                  NestDesk
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tenant Portal
                </p>
              </div>
            </Link>

            <span className="hidden rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground lg:inline-flex">
              {hostelName}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs text-muted-foreground md:block">
              {tenant.full_name}
            </span>
            <ThemeToggle />
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-6">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Tenant Workspace
                </p>
                <p className="text-xs text-muted-foreground">
                  Everything about your stay
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-border/60 bg-background/70 p-3">
              <p className="line-clamp-1 text-sm font-medium text-foreground">
                {hostelName}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BadgeCheck className="h-3 w-3" />
                {statusLabel}
              </p>
            </div>
          </div>

          <TenantNav />
        </aside>

        <main className="min-w-0 pb-8">{children}</main>
      </div>
    </div>
  );
}
