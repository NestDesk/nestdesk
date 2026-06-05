"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

interface MobileNavProps {
  isPhoneVerified: boolean;
}

export function MobileNav({ isPhoneVerified }: MobileNavProps) {
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
        className="w-60 p-0"
        sheetTitle="Main navigation"
        sheetDescription="Open the mobile navigation menu to access dashboard sections"
      >
        <Sidebar
          mobile
          onNavigate={() => setOpen(false)}
          isPhoneVerified={isPhoneVerified}
        />
      </SheetContent>
    </Sheet>
  );
}
