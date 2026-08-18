import type { ReactNode } from 'react';
import { Sidebar } from '@/component/layout/Sidebar';
import { SidebarStateProvider } from '@/component/layout/SidebarContext';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { MobileFloatingMenu } from '@/component/layout/MobileFloatingMenu';
import { InactivityLogout } from '@/component/system/InactivityLogout';
import { PageFabProvider } from '@/lib/hooks/use-page-fab';

export default function DashboardGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <RoleGuard>
      <SidebarStateProvider>
        <PageFabProvider>
          {/* Tidak merender apa pun — cuma pasang listener aktivitas &
              timer 30 menit (lihat InactivityLogout.tsx). Dipasang di sini
              (bukan root layout) supaya cuma aktif di area yang sudah
              pasti login. */}
          <InactivityLogout />
          <div className="flex min-h-screen bg-bg">
            <Sidebar />
            <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">{children}</div>
          </div>
          {/* Floating radial menu navigasi — hanya render kalau device
              mobile terdeteksi DAN halaman ini TIDAK sedang menampilkan
              FAB aksi tabel-nya sendiri (lihat use-page-fab.tsx), supaya
              tidak ada dua tombol "+" menumpuk. */}
          <MobileFloatingMenu />
        </PageFabProvider>
      </SidebarStateProvider>
    </RoleGuard>
  );
}
