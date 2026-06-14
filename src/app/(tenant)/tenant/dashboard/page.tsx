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
import { Badge } from "../../../../components/ui/badge";
import { getTenantProfileCompletion } from "../../../../lib/tenant-profile-completion";

const STATUS_CONFIG = {
  pending: {
    label: "Pending Approval",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-amber-500",
  },
  active: {
    label: "Active",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  moved_out: {
    label: "Moved Out",
    variant: "outline" as const,
    icon: Home,
    color: "text-muted-foreground",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
    icon: AlertCircle,
    color: "text-destructive",
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

      {completion.percentage < 100 && (
        <Card className="rounded-2xl border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <User className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="w-full">
              <p className="text-sm font-medium text-foreground">
                Profile completion: {completion.percentage}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Complete your profile and ID uploads to become eligible for
                activation.
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/15">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
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
        <Card className="rounded-2xl border-border/70 sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Account Status & Profile Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Account status
              </p>
              <div className="mt-3 flex items-center gap-3">
                <StatusIcon className={`h-5 w-5 ${statusCfg.color}`} />
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Current registration state for your tenant account.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Profile completion
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {completion.percentage}%
                  </p>
                </div>
                <p className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  {completion.completeCount}/{completion.totalCount}
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Complete your details and ID uploads to keep your account ready for activation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Room */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Room</CardTitle>
          </CardHeader>
          <CardContent>
            {room ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  Room {room.room_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  Capacity: {room.capacity}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Security deposit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">
              {securityDeposit != null ? `₹${securityDeposit}` : "-"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {securityDeposit != null ? "Security deposit amount" : "Not set yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Membership
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">{memberSince}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered as tenant
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
