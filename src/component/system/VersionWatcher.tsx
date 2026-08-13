'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { appInfoApi } from '@/lib/api/modules';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 menit — cukup jarang supaya tidak membebani server

/**
 * Cek versi aplikasi otomatis — dijalankan sekali di root layout (lihat
 * app/layout.tsx). Menyimpan versi yang PERTAMA kali dilihat browser ini
 * (saat halaman dimuat), lalu polling berkala ke GET /app/version. Kalau
 * server sudah di-deploy ulang dengan versi baru selagi user masih
 * membuka tab lama, muncul toast persisten yang menawarkan muat ulang
 * halaman — supaya user tidak terus memakai build frontend yang sudah
 * usang tanpa sadar.
 */
export function VersionWatcher(): null {
  const knownVersionRef = useRef<string | null>(null);
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion(): Promise<void> {
      try {
        const res = await appInfoApi.version();
        if (cancelled) return;

        if (knownVersionRef.current === null) {
          knownVersionRef.current = res.version;
          return;
        }

        if (res.version !== knownVersionRef.current && !hasNotifiedRef.current) {
          hasNotifiedRef.current = true;
          toast('Versi baru WMS-RSD tersedia!', {
            description: `${knownVersionRef.current} -> ${res.version}. Muat ulang halaman untuk memakai versi terbaru.`,
            duration: Infinity,
            action: {
              label: 'Muat Ulang',
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // Gagal cek versi (mis. offline sesaat) -> diam saja, coba lagi di interval berikutnya.
      }
    }

    checkVersion();
    const interval = window.setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
