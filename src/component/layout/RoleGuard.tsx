'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { maintenanceApi, type MaintenanceStatus } from '@/lib/api/modules';
import { StatusScreen } from '@/component/system/StatusScreen';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { getModuleForPath } from '@/auth/roles';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function MaintenanceBlockedScreen({ status }: Readonly<{ status: MaintenanceStatus }>): React.JSX.Element {
  const [remaining, setRemaining] = useState(status.remainingSeconds ?? 0);

  useEffect(() => {

    setRemaining(status.remainingSeconds ?? 0);
  }, [status.remainingSeconds]);

  useEffect(() => {
    if (!status.remainingSeconds) return;
    const tick = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [status.remainingSeconds]);

  const hasEstimate = Boolean(status.estimatedUntil && status.remainingSeconds);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-sidebarFrom via-accentDark to-sidebarTo px-6 text-center text-white">
      <span className="text-5xl" aria-hidden>
        🛠️
      </span>
      <h1 className="text-2xl font-bold">Sedang Dalam Pemeliharaan</h1>
      <p className="max-w-md text-sm text-white/80">
        {status.message || 'Sistem sedang dalam pemeliharaan untuk meningkatkan pengalaman pengelolaan barang di gudang,Harap bersabar terimakasih atas pengertiannya.'}
      </p>
      {hasEstimate ? (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-black/20 px-6 py-3">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">
            Perkiraan Selesai Dalam
          </span>
          <span className="font-mono text-3xl font-bold tabular-nums">
            {formatCountdown(remaining)}
          </span>
        </div>
      ) : null}
      <p className="text-xs text-white/60">
        Fitur akan kembali normal otomatis setelah pemeliharaan selesa, nanti dicoba lagi ketika waktuya habis.
      </p>
    </div>
  );
}

export function RoleGuard({ children, allowedRoles }: Readonly<RoleGuardProps>): React.JSX.Element | null {
  const { user, isLoading, serverUnreachable } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { can, isLoading: permissionsLoading, hasError: permissionsError } = usePermissions();
  const requiredModule = getModuleForPath(pathname);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (serverUnreachable) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/status/403');
      return;
    }
    // Blokir akses langsung lewat URL kalau "Lihat" untuk modul halaman ini
    // dimatikan buat role user (diatur lewat Perizinan Hak Akses User) —
    // bukan cuma menyembunyikan link-nya di sidebar. Tunggu matriks izin
    // selesai dimuat dulu supaya tidak salah redirect saat masih fetching.
    // permissionsError SENGAJA dikecualikan di sini — matrix izin gagal
    // dimuat (server/koneksi bermasalah) BUKAN berarti user ditolak, jadi
    // jangan redirect ke 403 "tidak ada izin" untuk kasus itu (lihat render
    // fallback "Coba Lagi" di bawah untuk kasus error ini).
    if (requiredModule && !permissionsLoading && !permissionsError && !can(requiredModule, 'view')) {
      router.replace('/status/403?reason=modul');
    }
  }, [isLoading, user, allowedRoles, router, serverUnreachable, requiredModule, permissionsLoading, permissionsError, can]);

  useEffect(() => {
    if (!user || user.role === 'super_admin') {
      return;
    }
    let cancelled = false;
    let timeoutId: number;

    async function poll(): Promise<void> {
      try {
        const res = await maintenanceApi.status();
        if (cancelled) return;

        if (wasActiveRef.current && !res.isActive) {
          toast.success('Pemeliharaan selesai. Kamu bisa melanjutkan aktivitas seperti biasa.', {
            duration: 6000,
          });
        }
        wasActiveRef.current = res.isActive;

        setMaintenance(res);

        if (!cancelled) {
          timeoutId = window.setTimeout(poll, res.isActive ? 5000 : 30000);
        }
      } catch {

        if (!cancelled) {
          timeoutId = window.setTimeout(poll, 30000);
        }
      }
    }
    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [user]);

  if (serverUnreachable) {
    return (
      <StatusScreen
        code="503"
        message="Server sedang mengalami bermasalah. Sesi kamu tetap aman halaman ini akan pulih otomatis begitu server kembali online."
        actions={[{ label: 'Coba Lagi', onClick: () => window.location.reload(), variant: 'primary' }]}
      />
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-textMuted">
        Memuat halaman...
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  if (requiredModule) {
    if (permissionsLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-bg text-textMuted">
          Memuat halaman...
        </div>
      );
    }
    if (permissionsError) {
      return (
        <StatusScreen
          code="503"
          message="Gagal memuat data izin akses kamu. Ini biasanya sementara — coba lagi, atau hubungi Super Admin kalau terus terjadi."
          actions={[{ label: 'Coba Lagi', onClick: () => window.location.reload(), variant: 'primary' }]}
        />
      );
    }
    if (!can(requiredModule, 'view')) {
      return null;
    }
  }

  if (maintenance?.isActive && user.role !== 'super_admin') {
    return <MaintenanceBlockedScreen status={maintenance} />;
  }

  return <>{children}</>;
}
