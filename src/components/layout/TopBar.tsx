"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "./MobileNav";
import { Navbar } from "./Navbar";
import {
  formatPlanLabel,
  normalizeOwnerPlan,
  type OwnerPlan,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

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
}

export function TopBar({
  title,
  isPhoneVerified = true,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: TopBarProps) {
  const router = useRouter();
  const [user, setUser] = useState<TopBarUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot>({
    plan: "free",
    status: "free",
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
      const [{ data: authData }, subscriptionRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch("/api/owner/subscription/current", { cache: "no-store" }).catch(
          () => null,
        ),
      ]);

      const authUser = authData.user;

      if (!authUser) {
        setUser(null);
        return;
      }

      const fullName =
        (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
        authUser.email?.split("@")[0] ||
        "Owner";

      const avatarUrl =
        (authUser.user_metadata?.avatar_url as string | undefined)?.trim() || null;

      setUser({
        fullName,
        email: authUser.email ?? "",
        avatarUrl,
      });

      if (subscriptionRes?.ok) {
        const payload = (await subscriptionRes.json().catch(() => null)) as {
          plan?: string;
          subscription?: { status?: SubscriptionStatus } | null;
        } | null;

        setSubscription({
          plan: normalizeOwnerPlan(payload?.plan),
          status: payload?.subscription?.status ?? "free",
        });
      }
    }

    loadUser().catch(() => {
      setUser(null);
    });
  }, []);

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
          <MobileNav isPhoneVerified={isPhoneVerified} />
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
          {title && (
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          )}
        </>
      }
      right={
        <>
          <ThemeToggle />
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
                  {user?.fullName || "Owner"}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email || "Signed in"}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
                  {formatPlanLabel(subscription.plan)} plan
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/profile")}
              >
                <LayoutDashboard className="h-4 w-4" />
                My Account
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/subscriptions")}
              >
                <CreditCard className="h-4 w-4" />
                Subscriptions
              </DropdownMenuItem>
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
