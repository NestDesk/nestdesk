"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { IdleTimeoutEnforcer } from "../auth/IdleTimeoutEnforcer";
import { Button } from "../ui/button";
import { type OwnerPlan } from "../../lib/subscriptions";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  isPhoneVerified: boolean;
}

export function DashboardShell({
  children,
  title,
  isPhoneVerified,
}: DashboardShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<OwnerPlan | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      try {
        const res = await fetch("/api/owner/subscription/current", {
          cache: "no-store",
        });
        if (!mounted) return;

        if (!res.ok) {
          setCurrentPlan(null);
          setSubscriptionLoaded(true);
          return;
        }

        const payload = (await res.json().catch(() => null)) as {
          plan?: string;
        } | null;

        setCurrentPlan((payload?.plan as OwnerPlan) ?? "free");
      } catch {
        if (mounted) {
          setCurrentPlan(null);
        }
      } finally {
        if (mounted) {
          setSubscriptionLoaded(true);
        }
      }
    }

    loadSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  const freePlanAllowedPrefixes = [
    "/dashboard",
    "/tenants",
    "/payments",
    "/subscriptions",
    "/hostels",
    "/profile",
    "/settings",
  ];

  const showUpgradeOverlay =
    subscriptionLoaded &&
    currentPlan === "free" &&
    !freePlanAllowedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IdleTimeoutEnforcer />
      <Sidebar
        collapsed={isSidebarCollapsed}
        isPhoneVerified={isPhoneVerified}
        currentPlan={currentPlan ?? "free"}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={title}
          isPhoneVerified={isPhoneVerified}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl animate-fade-in relative">
            <div
              className={
                showUpgradeOverlay
                  ? "pointer-events-none select-none blur-sm transition duration-200"
                  : "transition duration-200"
              }
            >
              {children}
            </div>

            {showUpgradeOverlay ? (
              <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-[2rem] border border-border bg-background/95 p-8 text-center shadow-2xl shadow-black/10 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    Upgrade required
                  </p>
                  <h2 className="mt-4 text-2xl font-semibold text-foreground">
                    This page is included in paid plans only.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Free users can access Dashboard, Tenants, Payments, and
                    Subscriptions. Upgrade your plan to unlock all owner portal pages
                    and full property management workflows.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                      type="button"
                      onClick={() => router.push("/subscriptions")}
                    >
                      Update plan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push("/dashboard")}
                    >
                      Go to dashboard
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
