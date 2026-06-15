"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar collapsed={isSidebarCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopBar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div key={pathname} className="mx-auto w-full max-w-8xl animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
