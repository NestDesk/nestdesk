"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LogOut, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "./MobileNav";
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

interface TopBarProps {
  title?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function TopBar({
  title,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: TopBarProps) {
  const router = useRouter();
  const [user, setUser] = useState<TopBarUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const userLoadedRef = useRef(false);

  useEffect(() => {
    if (userLoadedRef.current) {
      return;
    }
    userLoadedRef.current = true;

    async function loadUser() {
      const supabase = createBrowserClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

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
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
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
        {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
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
            </DropdownMenuLabel>
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
      </div>
    </header>
  );
}
