import Link from "next/link";
import { Building2 } from "lucide-react";

import { cn } from "../../lib/utils";

// ── Navbar Shell ───────────────────────────────────────────────────────────────
// Sticky top navbar with consistent height, blur, and border used across all
// variants: landing, auth, dashboard (owner), tenant portal.
// Pass content via left / center / right slots.

interface NavbarProps {
  left: React.ReactNode;
  /** Centered nav links – rendered absolutely centered, hidden on mobile */
  center?: React.ReactNode;
  right: React.ReactNode;
  /**
   * When true the inner container spans full width with no max-w / mx-auto.
   * Use for the dashboard layout where the topbar lives inside a sidebar shell.
   */
  fullWidth?: boolean;
  /** Tailwind z-index class, default "z-50" */
  zIndex?: string;
  className?: string;
}

export function Navbar({
  left,
  center,
  right,
  fullWidth = false,
  zIndex = "z-50",
  className,
}: NavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 inset-x-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md shadow-sm",
        zIndex,
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-16 items-center justify-between px-4 sm:px-6",
          !fullWidth && "mx-auto max-w-7xl",
        )}
      >
        <div className="flex items-center gap-2">{left}</div>

        {center ? (
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            {center}
          </nav>
        ) : null}

        <div className="flex items-center gap-2 sm:gap-3">{right}</div>
      </div>
    </header>
  );
}

// ── NavbarLogo ─────────────────────────────────────────────────────────────────
// Shared NestDesk logo used in landing, auth, and tenant navbars.

interface NavbarLogoProps {
  /** Link target, defaults to "/" */
  href?: string;
  /** Optional subtitle shown below "NestDesk", e.g. "Tenant Portal" */
  subtitle?: string;
}

export function NavbarLogo({ href = "/", subtitle }: NavbarLogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
        <Building2 className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold leading-none text-foreground">NestDesk</p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
