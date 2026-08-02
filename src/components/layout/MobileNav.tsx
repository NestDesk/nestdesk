"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Sidebar, type PortalType } from "./Sidebar";

interface MobileNavProps {
  isPhoneVerified?: boolean;
  portal?: PortalType;
}

export function MobileNav({
  isPhoneVerified = true,
  portal = "owner",
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-none bg-[hsl(var(--sidebar-background))] p-0 shadow-2xl"
        sheetTitle="Main navigation"
        sheetDescription="Open the mobile navigation menu to access dashboard sections"
      >
        <Sidebar
          mobile
          onNavigate={() => setOpen(false)}
          isPhoneVerified={isPhoneVerified}
          portal={portal}
        />
      </SheetContent>
    </Sheet>
  );
}
