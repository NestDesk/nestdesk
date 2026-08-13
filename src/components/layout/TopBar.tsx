  "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { MobileNav } from "./MobileNav";
import { Navbar } from "./Navbar";
import { getOwnerPageDetails } from "./owner-page-details";
import { getTenantPageDetails } from "./tenant-page-details";
import type { PortalType } from "./Sidebar";
import {
  formatPlanLabel,
  type OwnerPlan,
  type SubscriptionStatus,
} from "../../lib/subscriptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { createClient as createBrowserClient } from "../../lib/supabase/client";

type TopBarUser = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

type SubscriptionSnapshot = {
  plan: OwnerPlan;
  status: SubscriptionStatus | "free";
};

interface TopBarProps {
  title?: string;
  isPhoneVerified?: boolean;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  portal?: PortalType;
  userName?: string;
  subscriptionPlan?: OwnerPlan;
  subscriptionStatus?: SubscriptionStatus | "free";
}

export function TopBar({
  title,
  isPhoneVerified = true,
  isSidebarCollapsed = false,
  onToggleSidebar,
  portal = "owner",
  userName,
  subscriptionPlan,
  subscriptionStatus,
}: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activePage =
    portal === "tenant"
      ? getTenantPageDetails(pathname)
      : getOwnerPageDetails(pathname);
  const ActivePageIcon = activePage?.icon;
  const [user, setUser] = useState<TopBarUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot>({
    plan: subscriptionPlan ?? "free",
    status: subscriptionStatus ?? "free",
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const userLoadedRef = useRef(false);

  useEffect(() => {
    if (userLoadedRef.current) {
      return;
    }

    userLoadedRef.current = true;

    async function loadUser() {
      const supabase = createBrowserClient();
      const { data: authData } = await supabase.auth.getUser();

      const authUser = authData.user;

      if (!authUser) {
        setUser(null);
        return;
      }

      const fullName =
        userName?.trim() ||
        (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
        authUser.email?.split("@")[0] ||
        (portal === "tenant" ? "Tenant" : "Owner");

      const avatarUrl =
        (authUser.user_metadata?.avatar_url as string | undefined)?.trim() || null;

      setUser({
        fullName,
        email: authUser.email ?? "",
        avatarUrl,
      });

    }

    loadUser().catch(() => {
      setUser(null);
    });
  }, [portal, userName]);

  useEffect(() => {
    if (subscriptionPlan === undefined && subscriptionStatus === undefined) {
      return;
    }

    setSubscription({
      plan: subscriptionPlan ?? "free",
      status: subscriptionStatus ?? "free",
    });
  }, [subscriptionPlan, subscriptionStatus]);

  const statusPill = useMemo(() => {
    const plan = formatPlanLabel(subscription.plan);
    const status =
      subscription.status === "free" || subscription.status === "active"
        ? "Active"
        : subscription.status === "grace_period"
          ? "Grace period"
          : "Expired";

    const badgeClass =
      status === "Active"
        ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-400 ring-1 ring-emerald-500/20 shadow-sm"
        : status === "Grace period"
          ? "bg-amber-500/15 text-amber-800"
          : "bg-rose-500/15 text-rose-800";

    return {
      planLabel: `Plan: ${plan}`,
      status,
      badgeClass,
    };
  }, [subscription.plan, subscription.status]);

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "ND";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [user?.email, user?.fullName]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.replace("/");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Navbar
      fullWidth
      left={
        <>
          <MobileNav isPhoneVerified={isPhoneVerified} portal={portal} />
          {onToggleSidebar ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden rounded-xl md:inline-flex"
              onClick={onToggleSidebar}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {activePage ? (
            <div className="relative flex min-w-0 items-center gap-1.5 border-l border-border/70 pl-2 sm:gap-2 sm:pl-3">
              {ActivePageIcon ? (
                <ActivePageIcon className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
              <h1 className="min-w-0 whitespace-normal break-words text-sm font-semibold text-foreground">
                {activePage.title}
              </h1>
            </div>
          ) : null}
          {!activePage && title ? (
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          ) : null}
        </>
      }
      right={
        <>
          <ThemeToggle />
          {portal === "owner" ? <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/80 px-3 py-1 text-xs text-foreground md:inline-flex">
            <span className="font-semibold text-foreground">
              {statusPill.planLabel}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 uppercase font-semibold ${statusPill.badgeClass}`}
            >
              {statusPill.status}
            </span>
          </div> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Open profile menu"
              >
                <Avatar className="h-8 w-8 border border-border/60">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="min-w-0 px-2 py-1.5">
                <p className="truncate text-sm font-medium">
                  {user?.fullName || (portal === "tenant" ? "Tenant" : "Owner")}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email || "Signed in"}
                </p>
                {portal === "owner" ? (
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
                    {formatPlanLabel(subscription.plan)} plan
                  </p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push(portal === "tenant" ? "/tenant/profile" : "/profile")}
              >
                <LayoutDashboard className="h-4 w-4" />
                My Account
              </DropdownMenuItem>
              {portal === "owner" ? (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push("/subscriptions")}
                >
                  <CreditCard className="h-4 w-4" />
                  Subscriptions
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
