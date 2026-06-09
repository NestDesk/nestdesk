"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";
import { TenantNav } from "./TenantNav";

export function TenantMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl md:hidden"
          aria-label="Open tenant navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0"
        sheetTitle="Tenant navigation"
        sheetDescription="Open the tenant navigation menu"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Menu className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Tenant Portal</p>
              <p className="text-xs text-muted-foreground">Quick navigation</p>
            </div>
          </div>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </Button>
          </SheetClose>
        </div>

        <div className="p-4">
          <TenantNav variant="mobile" onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
