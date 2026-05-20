"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/hostels", icon: Building2 },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Notices", href: "/notices", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-sidebar-foreground">NestDesk</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            AK
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              Ahmad Khan
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              owner@email.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
