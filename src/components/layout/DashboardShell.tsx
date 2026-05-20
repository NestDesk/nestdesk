import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { IdleTimeoutEnforcer } from "@/components/auth/IdleTimeoutEnforcer";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardShell({ children, title }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IdleTimeoutEnforcer />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
