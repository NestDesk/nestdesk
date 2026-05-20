"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 px-0 pb-6 pt-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">NestDesk</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav links */}
        <nav className="mt-4 flex flex-col gap-1 px-3">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="mt-6 flex flex-col gap-3 px-5">
          <Link href="/login" onClick={() => setOpen(false)}>
            <Button className="w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:brightness-110">
              Sign in
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
