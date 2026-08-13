import type { ReactNode } from 'react';
import { Sidebar } from '@/component/layout/Sidebar';
import { SidebarStateProvider } from '@/component/layout/SidebarContext';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { MobileFloatingMenu } from '@/component/layout/MobileFloatingMenu';
import { NotificationsProvider } from '@/lib/notifications-context';
import { PageFabProvider } from '@/lib/hooks/use-page-fab';

export default function DashboardGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <RoleGuard>
      <SidebarStateProvider>
        {/* NotificationsProvider dipasang di SINI (bukan root layout) --
            sengaja hanya untuk area yang sudah pasti berstatus login,
            karena isinya polling ke GET /dashboard/notifications (butuh
            token) setiap beberapa detik. SEBELUM INI provider-nya memang
            ada di kode tapi TIDAK PERNAH dipasang di mana pun (bug nyata
            yang baru ketahuan), jadi seluruh sistem notifikasi bel/toast
            (termasuk notifikasi tugas & barang baru) sebenarnya belum
            pernah benar-benar berjalan sampai baris ini ditambahkan. */}
        <NotificationsProvider>
          <PageFabProvider>
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
        </NotificationsProvider>
      </SidebarStateProvider>
    </RoleGuard>
  );
}
