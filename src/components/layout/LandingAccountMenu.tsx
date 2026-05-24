"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut } from "lucide-react";

export type LandingAccountUser = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

export function LandingAccountMenu({ user }: { user: LandingAccountUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = useMemo(() => {
    const source = user.fullName || user.email || "ND";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [user.email, user.fullName]);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open account menu"
        >
          <Avatar className="h-8 w-8 border border-border/60">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.fullName} />
            ) : null}
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 rounded-xl">
        <DropdownMenuLabel className="min-w-0 px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.fullName || ""}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user.email || "Signed in"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/dashboard")}
        >
          <LayoutDashboard className="h-4 w-4" />
          My Account
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
  );
}
