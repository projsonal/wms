import type { ReactNode } from 'react';
import { Sidebar } from '@/component/layout/Sidebar';
import { SidebarStateProvider } from '@/component/layout/SidebarContext';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { MobileFloatingMenu } from '@/component/layout/MobileFloatingMenu';
import { InactivityLogout } from '@/component/system/InactivityLogout';
import { PageFabProvider } from '@/lib/hooks/use-page-fab';

export default function DashboardGroupLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return (
    <RoleGuard>
      <SidebarStateProvider>
        <PageFabProvider>
          <InactivityLogout />
          <div className="flex min-h-screen bg-bg">
            <Sidebar />
            <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">{children}</div>
          </div>
          <MobileFloatingMenu />
        </PageFabProvider>
      </SidebarStateProvider>
    </RoleGuard>
  );
}
