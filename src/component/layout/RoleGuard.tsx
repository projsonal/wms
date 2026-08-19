'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { maintenanceApi, type MaintenanceStatus } from '@/lib/api/modules';
import { StatusScreen } from '@/component/system/StatusScreen';
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

/** Layar penuh saat mode pemeliharaan aktif untuk role selain super_admin
 * (lihat Settings -> Sistem -> Mode Pemeliharaan & internal/middleware
 * MaintenanceMode di backend — ini padanan tampilannya di frontend).
 * Menampilkan hitung mundur REAL-TIME menuju estimasi selesai yang diisi
 * Super Admin — detik dihitung lokal tiap 1 detik (biar mulus), lalu
 * disinkronkan ulang setiap kali RoleGuard poll status terbaru dari
 * server (tiap 30 detik) supaya tidak melenceng jauh dari waktu server. */
function MaintenanceBlockedScreen({ status }: { status: MaintenanceStatus }): React.JSX.Element {
  const [remaining, setRemaining] = useState(status.remainingSeconds ?? 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronkan ulang tiap kali prop status berubah (hasil poll baru)
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
        {status.message || 'Sistem sedang dalam pemeliharaan, silakan hubungi Super Admin.'}
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
        Fitur akan kembali normal otomatis setelah pemeliharaan selesai — kamu akan diberi tahu.
      </p>
    </div>
  );
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps): React.JSX.Element | null {
  const { user, isLoading, serverUnreachable } = useAuth();
  const router = useRouter();
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    // Backend tidak bisa dihubungi (5xx/gagal jaringan) BUKAN "belum
    // login" — jangan lempar ke /login (bisa bikin user login ulang
    // sia-sia padahal sesinya masih sah), biarkan render StatusScreen 503
    // di bawah sampai backend pulih lagi.
    if (serverUnreachable) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/status/403');
    }
  }, [isLoading, user, allowedRoles, router, serverUnreachable]);

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
        // Transisi aktif -> tidak aktif terdeteksi -> beri tahu user secara
        // eksplisit ("silakan lanjutkan aktivitas") alih-alih cuma diam-diam
        // membiarkan halaman kembali normal tanpa penjelasan apa pun.
        if (wasActiveRef.current && !res.isActive) {
          toast.success('Pemeliharaan selesai! Kamu bisa melanjutkan aktivitas seperti biasa.', {
            duration: 6000,
          });
        }
        wasActiveRef.current = res.isActive;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- polling async, bukan set-state sinkron dalam efek
        setMaintenance(res);
        // Polling lebih SERING (5 detik) SELAGI diblokir supaya hitung
        // mundur & deteksi "sudah selesai" terasa responsif; balik ke 30
        // detik begitu normal lagi, supaya tidak membebani server saat
        // maintenance memang jarang terjadi.
        if (!cancelled) {
          timeoutId = window.setTimeout(poll, res.isActive ? 5000 : 30000);
        }
      } catch {
        // gagal cek status -> anggap tidak maintenance, jangan blokir user karena error jaringan
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
        message="Server tidak bisa dihubungi. Sesi kamu tetap aman — halaman ini akan pulih otomatis begitu server kembali online."
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

  if (maintenance?.isActive && user.role !== 'super_admin') {
    return <MaintenanceBlockedScreen status={maintenance} />;
  }

  return <>{children}</>;
}
