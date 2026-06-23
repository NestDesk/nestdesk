import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Home,
  Megaphone,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { formatDateInIndia } from "../../../../lib/date";
import { getTenantProfileCompletion } from "../../../../lib/tenant-profile-completion";

const STATUS_CONFIG = {
  pending: {
    label: "Pending Approval",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-amber-500",
    badgeClassName:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    summary: "Pending approval",
    description: "Your registration is awaiting review from the property owner.",
  },
  active: {
    label: "Active",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-emerald-500",
    badgeClassName:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    summary: "Active live status",
    description: "Your tenant account is currently active and live.",
  },
  moved_out: {
    label: "Moved Out",
    variant: "outline" as const,
    icon: Home,
    color: "text-muted-foreground",
    badgeClassName:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
    summary: "Moved out",
    description: "Your stay has been marked as moved out for this property.",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
    icon: AlertCircle,
    color: "text-destructive",
    badgeClassName:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
    summary: "Registration not approved",
    description: "Your account was not approved by the property owner.",
  },
};

export default async function TenantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, full_name, email, phone, status, join_date, room_id, hostel_id, occupation_type, institution_name, aadhar_last4, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, security_deposit, hostels(name, address, city, state, pincode, property_type), rooms(room_number, capacity)",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) redirect("/login");

  const status = tenant.status as keyof typeof STATUS_CONFIG;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  // @ts-expect-error supabase nested select
  const room = tenant.rooms as { room_number: string; capacity: number } | null;

  const firstName = tenant.full_name.split(" ")[0];
  const memberSince = tenant.join_date
    ? formatDateInIndia(tenant.join_date, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not available";
  const securityDeposit =
    tenant.security_deposit != null ? Number(tenant.security_deposit) : null;
  const completion = getTenantProfileCompletion(tenant);
  const maintenanceLimit = 3;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const maintenanceRequestsCount =
    (await admin
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd)
      .is("deleted_at", null))?.count ?? 0;

  const { data: latestNotice } = await admin
    .from("notices")
    .select("id, title, body, published_at")
    .eq("hostel_id", tenant.hostel_id)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-blue-500/10">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
              Tenant Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              View your account status, stay details, and property updates in one
              place.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                 <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-muted-foreground">
                <CalendarClock className="mr-1.5 h-3 w-3" />
                Member since {memberSince}
              </span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-muted-foreground">
                <Wrench className="mr-1.5 h-3 w-3" />
                Maintenance Requests used: {maintenanceRequestsCount}/{maintenanceLimit}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
            <Link
              href="/tenant/payments"
              className="group rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-background"
            >
              <span className="flex items-center text-foreground">
                <CreditCard className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Payments
              </span>
              <span className="mt-1 inline-flex items-center text-xs text-muted-foreground">
                View history
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/tenant/notices"
              className="group rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-background"
            >
              <span className="flex items-center text-foreground">
                <Megaphone className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Notices
              </span>
              <span className="mt-1 inline-flex items-center text-xs text-muted-foreground">
                Stay updated
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/tenant/maintenance"
              className="group rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-background"
            >
              <span className="flex items-center text-foreground">
                <Wrench className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Maintenance
              </span>
              <span className="mt-1 inline-flex items-center text-xs text-muted-foreground">
                Raise requests
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/tenant/profile"
              className="group rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-background"
            >
              <span className="flex items-center text-foreground">
                <User className="mr-1.5 h-3.5 w-3.5 text-primary" />
                My Profile
              </span>
              <span className="mt-1 inline-flex items-center text-xs text-muted-foreground">
                Manage details
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Pending approval banner */}
      {status === "pending" && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Registration pending approval
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your registration is waiting for the property owner to review it. You
                will be notified once it is approved.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected banner */}
      {status === "rejected" && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Registration not approved
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Please contact the property owner for more information.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border border-primary/15 bg-gradient-to-br from-background via-primary/8 to-blue-500/10 shadow-sm sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-primary">
                  Overview
                </p>
                <CardTitle className="mt-1 text-lg font-semibold text-foreground">
                  Account Status & Profile Completion
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  A quick snapshot of your live account health and profile readiness.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-background/90 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Progress</div>
                <div className="text-lg font-semibold text-foreground">{completion.percentage}%</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/8 via-background to-background p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Account status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{statusCfg.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {statusCfg.description}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusCfg.badgeClassName}`}>
                  <StatusIcon className={`h-3.5 w-3.5 ${statusCfg.color}`} />
                  {statusCfg.label}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Profile completion
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {completion.completeCount}/{completion.totalCount} steps completed
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  Completed
                </span>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {completion.completeCount === completion.totalCount
                  ? "All profile completion steps are finished, so your account is ready to go."
                  : `${completion.totalCount - completion.completeCount} step(s) still need attention.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-primary/15 bg-gradient-to-br from-background via-primary/8 to-blue-500/10 shadow-sm sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">             
              <span className="rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Stay essentials
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Home className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Assigned room</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {room ? `Room ${room.room_number}` : "Not assigned yet"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {room ? `Capacity: ${room.capacity} occupants` : "Room details will appear here once assigned."}
              </p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Security deposit</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {securityDeposit != null ? `₹${securityDeposit}` : "-"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {securityDeposit != null ? "Security deposit amount on record" : "Security deposit not set yet"}
              </p>
            </div>
          </CardContent>

          <CardContent className="pt-0">
            <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest notice</p>
                  <p className="text-sm font-semibold text-foreground">
                    {latestNotice?.title ?? "No published notice yet"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
                {latestNotice?.body ?? "Your property owner’s latest notice will appear here once it is published."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
