"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { IdleTimeoutEnforcer } from "../auth/IdleTimeoutEnforcer";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  isPhoneVerified: boolean;
}

export function DashboardShell({
  children,
  title,
  isPhoneVerified,
}: DashboardShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IdleTimeoutEnforcer />
      <Sidebar collapsed={isSidebarCollapsed} isPhoneVerified={isPhoneVerified} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={title}
          isPhoneVerified={isPhoneVerified}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
