"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "../layout/ThemeToggle";
import { PanelLeft, PanelRight, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Navbar } from "../layout/Navbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { createClient as createBrowserClient } from "../../lib/supabase/client";
import { AdminMobileNav } from "./AdminMobileNav";
import { Badge } from "../ui/badge";

interface AdminTopBarProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AdminTopBar({
  isSidebarCollapsed = false,
  onToggleSidebar,
}: AdminTopBarProps) {
  const [email, setEmail] = useState<string>("");
  const [loggingOut, setLoggingOut] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "support@nestdesk.in");
    });
  }, []);

  const initials = useMemo(() => {
    const parts = email.split("@")[0]?.split(".") ?? ["AD"];
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }, [email]);

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
          <AdminMobileNav />
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
          <Badge
            variant="outline"
            className="hidden gap-1.5 border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 sm:inline-flex"
          >
            <ShieldCheck className="h-3 w-3" />
            Admin Console
          </Badge>
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
                aria-label="Open admin menu"
              >
                <Avatar className="h-8 w-8 border border-violet-500/40">
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-500 text-xs text-white">
                    {initials || "AD"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Signed in as
                </p>
                <p className="truncate text-sm font-semibold">{email}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  Company Admin
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
