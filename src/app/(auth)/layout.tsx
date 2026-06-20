import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { ThemeToggle } from "../../components/layout/ThemeToggle";
import { Navbar, NavbarLogo } from "../../components/layout/Navbar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <Navbar
        left={<NavbarLogo />}
        right={
          <>
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="rounded-xl">
                Sign in
              </Button>
            </Link>
          </>
        }
      />

      {/* Centered card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
