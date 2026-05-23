"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutDashboard, Megaphone, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

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
] as const;

export function TenantNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
      {NAV_ITEMS.map(({ href, label, hint, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex min-w-[170px] items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-150 sm:min-w-0",
              isActive
                ? "border-primary/40 bg-gradient-to-r from-primary/15 to-blue-500/10 text-foreground shadow-sm"
                : "border-border/60 bg-background/70 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "mt-0.5 rounded-md p-1",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {hint}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
