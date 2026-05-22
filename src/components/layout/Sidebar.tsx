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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Properties", href: "/hostels", icon: Building2 },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Notices", href: "/notices", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  collapsed = false,
  mobile = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

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
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed && !mobile ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <div className="glow-ring flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <span className="text-sm font-bold text-sidebar-foreground">NestDesk</span>
        )}
      </div>

      <TooltipProvider delayDuration={100}>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ label, href, icon: Icon }) => {
            const navLink = (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed && !mobile && "justify-center px-2",
                  pathname === href
                    ? "bg-gradient-to-r from-primary/80 to-blue-500/70 text-white shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || mobile) && label}
              </Link>
            );

            if (collapsed && !mobile) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
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
