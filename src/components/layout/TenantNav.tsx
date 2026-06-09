"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  User,
  Wrench,
  Users,
} from "lucide-react";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  {
    href: "/tenant/dashboard",
    label: "Dashboard",
    hint: "Overview and account status",
    icon: LayoutDashboard,
  },
  {
    href: "/tenant/profile",
    label: "My Profile",
    hint: "Personal and stay details",
    icon: User,
  },
  {
    href: "/tenant/payments",
    label: "Payments",
    hint: "Rent history and receipts",
    icon: CreditCard,
  },
  {
    href: "/tenant/notices",
    label: "Notices",
    hint: "Property announcements",
    icon: Megaphone,
  },
  {
    href: "/tenant/maintenance",
    label: "Maintenance",
    hint: "Raise and track requests",
    icon: Wrench,
  },
  {
    href: "/tenant/support-staff",
    label: "Support Staff",
    hint: "Property contact numbers",
    icon: Users,
  },
  {
    href: "/tenant/terms",
    label: "Terms & Conditions",
    hint: "Property rules and contacts",
    icon: FileText,
  },
] as const;

interface TenantNavProps {
  variant?: "default" | "mobile";
  onNavigate?: () => void;
}

export function TenantNav({ variant = "default", onNavigate }: TenantNavProps) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";

  return (
    <nav
      className={cn(
        isMobile
          ? "space-y-3"
          : "flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0",
      )}
    >
      {NAV_ITEMS.map(({ href, label, hint, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group rounded-2xl border transition-all duration-150",
              isMobile
                ? "flex w-full items-center gap-3 px-4 py-4"
                : "flex min-w-[170px] items-start gap-2.5 px-3 py-2.5 transition-all duration-150 sm:min-w-0",
              isActive
                ? "border-primary/40 bg-gradient-to-r from-primary/15 to-blue-500/10 text-foreground shadow-sm"
                : "border-border/60 bg-background/70 text-foreground/90 hover:border-border hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "rounded-md p-2",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-foreground/80 group-hover:text-foreground",
              )}
            >
              <Icon className={cn(isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{label}</span>
              <span
                className={cn(
                  "block truncate text-[11px]",
                  isActive
                    ? "text-foreground/70"
                    : "text-foreground/70 group-hover:text-foreground/90",
                )}
              >
                {hint}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
