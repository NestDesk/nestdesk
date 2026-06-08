"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Building2,
  Users,
  BedDouble,
  CreditCard,
  WalletCards,
  BarChart2,
  Bell,
  Wrench,
  UserCircle2,
  Rocket,
  Settings,
  AlertCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { type OwnerPlan } from "../../lib/subscriptions";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Properties", href: "/hostels", icon: Building2 },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Expenses", href: "/expenses", icon: WalletCards },
  { label: "Occupancy", href: "/occupancy", icon: BedDouble },
  { label: "Notices", href: "/notices", icon: Bell },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "My Profile", href: "/profile", icon: UserCircle2 },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "Subscriptions & Usage", href: "/subscriptions", icon: Rocket },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  isPhoneVerified: boolean;
  currentPlan?: OwnerPlan;
}

const freePlanAllowedPages = new Set([
  "/dashboard",
  "/tenants",
  "/payments",
  "/subscriptions",
  "/hostels",
  "/profile",
  "/settings",
]);

const isFreePlanAllowedSidebarHref = (href: string) =>
  freePlanAllowedPages.has(href) ||
  freePlanAllowedPages.has(href.split("/")[1] ? `/${href.split("/")[1]}` : href);

export function Sidebar({
  collapsed = false,
  mobile = false,
  onNavigate,
  isPhoneVerified,
  currentPlan,
}: SidebarProps) {
  const pathname = usePathname();
  const [propertyWarning, setPropertyWarning] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPropertyWarning() {
      try {
        const res = await fetch("/api/hostels", { cache: "no-store" });
        if (!res.ok) {
          setPropertyWarning(null);
          return;
        }

        const json = await res.json();
        const hostels = Array.isArray(json.hostels)
          ? (json.hostels as Array<{ is_active?: boolean }>)
          : [];

        if (hostels.length === 0) {
          if (mounted) {
            setPropertyWarning(
              "You don’t have any properties yet. Add one to start managing rooms, tenants, and payments.",
            );
          }
          return;
        }

        const allInactive =
          hostels.length > 0 &&
          hostels.every((hostel) => hostel.is_active === false);
        if (allInactive) {
          if (mounted) {
            setPropertyWarning(
              "All your properties are inactive. Activate one to start accepting tenants and managing rooms.",
            );
          }
          return;
        }

        if (mounted) {
          setPropertyWarning(null);
        }
      } catch {
        if (mounted) {
          setPropertyWarning(null);
        }
      }
    }

    loadPropertyWarning();

    const handleHostelStatusChanged = () => {
      loadPropertyWarning();
    };

    window.addEventListener("hostel-status-changed", handleHostelStatusChanged);

    return () => {
      mounted = false;
      window.removeEventListener("hostel-status-changed", handleHostelStatusChanged);
    };
  }, []);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        mobile ? "w-72" : "hidden md:flex",
        !mobile && (collapsed ? "w-20" : "w-60"),
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed && !mobile ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div className="glow-ring flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          {(!collapsed || mobile) && (
            <span className="flex flex-col">
              <span className="text-sm font-bold leading-tight text-sidebar-foreground">
                NestDesk
              </span>
              <span className="text-[11px] leading-tight text-sidebar-foreground/60">
                Owner Portal
              </span>
            </span>
          )}
        </Link>
      </div>

      <TooltipProvider delayDuration={100}>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ label, href, icon: Icon }) => {
            const showUnverifiedWarning = label === "My Profile" && !isPhoneVerified;
            const showPropertyWarning =
              label === "My Properties" && Boolean(propertyWarning);
            const isRestricted =
              currentPlan === "free" && !isFreePlanAllowedSidebarHref(href);

            const navLink = (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed && !mobile && "justify-center px-2",
                  pathname === href
                    ? "bg-gradient-to-r from-primary/80 to-blue-500/70 text-white shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                  isRestricted && "opacity-60",
                )}
              >
                <div className="relative">
                  <Icon className="h-4 w-4 shrink-0" />
                  {(showPropertyWarning || showUnverifiedWarning) &&
                  collapsed &&
                  !mobile ? (
                    <span className="absolute -right-4 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                      <AlertCircle className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
                {(!collapsed || mobile) && (
                  <span className="inline-flex items-center gap-1.5">
                    {label}
                    {showPropertyWarning ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {propertyWarning}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    {showUnverifiedWarning ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Phone number not verified
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </span>
                )}
              </Link>
            );

            if (collapsed && !mobile) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right">
                    {showPropertyWarning
                      ? propertyWarning
                      : showUnverifiedWarning
                        ? "Phone number not verified"
                        : label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
