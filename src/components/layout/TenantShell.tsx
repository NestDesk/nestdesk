"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { IdleTimeoutEnforcer } from "../auth/IdleTimeoutEnforcer";

interface TenantShellProps {
  children: React.ReactNode;
  tenantName: string;
}

export function TenantShell({ children, tenantName }: TenantShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IdleTimeoutEnforcer />
      <Sidebar
        portal="tenant"
        collapsed={isSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          portal="tenant"
          userName={tenantName}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((previous) => !previous)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="w-full animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
