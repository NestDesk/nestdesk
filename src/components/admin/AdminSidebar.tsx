"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Megaphone,
  Wrench,
  ShieldCheck,
  Coins,
  BarChart3,
  Tag,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

const navItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Owners", href: "/admin/owners", icon: Users },
  { label: "Properties", href: "/admin/properties", icon: Building2 },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: BarChart3 },
  { label: "Custom Plans", href: "/admin/planner", icon: Tag },
  { label: "Credits", href: "/admin/credits", icon: Coins },
  { label: "Leads", href: "/admin/leads", icon: TrendingUp },
  { label: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { label: "Notices", href: "/admin/notices", icon: Megaphone },
  { label: "Audit Logs", href: "/admin/audit", icon: ShieldCheck },
];

interface AdminSidebarProps {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function AdminSidebar({
  collapsed = false,
  mobile = false,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        mobile ? "w-72" : "hidden md:flex",
        !mobile && (collapsed ? "w-20" : "w-60"),
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed && !mobile ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 shadow shadow-violet-500/30">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          {(!collapsed || mobile) && (
            <span className="flex flex-col">
              <span className="text-sm font-bold leading-tight text-sidebar-foreground">
                NestDesk
              </span>
              <span className="text-[11px] leading-tight text-sidebar-foreground/60">
                Admin Console
              </span>
            </span>
          )}
        </Link>
      </div>

      <TooltipProvider delayDuration={100}>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ label, href, icon: Icon, exact }) => {
            const isActive = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

            const navLink = (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed && !mobile && "justify-center px-2",
                  isActive
                    ? "bg-gradient-to-r from-violet-600/80 to-indigo-500/70 text-white shadow-md shadow-violet-500/20"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || mobile) && <span>{label}</span>}
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

      {(!collapsed || mobile) && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
            Company Admin
          </p>
          <p className="mt-0.5 text-[11px] text-sidebar-foreground/50">
            support@nestdesk.in
          </p>
        </div>
      )}
    </aside>
  );
}
