import type { ReactNode } from 'react';
import { Sidebar } from '@/component/layout/Sidebar';
import { SidebarStateProvider } from '@/component/layout/SidebarContext';
import { RoleGuard } from '@/component/layout/RoleGuard';

export default function DashboardGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <RoleGuard>
      <SidebarStateProvider>
        <div className="flex min-h-screen bg-bg">
          <Sidebar />
          <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </SidebarStateProvider>
    </RoleGuard>
  );
}
