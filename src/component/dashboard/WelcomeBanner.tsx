'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ROLE_LABEL } from '@/auth/roles';
import { BoxIcon, ForkliftIcon, PalletIcon, ShelfIcon } from '@/component/ui/WarehouseIcons';
import type { UserRole } from '@/types';

interface WelcomeBannerProps {
  fullName: string;
  role: UserRole;
}

const ROLE_SUBTITLE: Record<UserRole, string> = {
  super_admin: 'Semua modul gudang & inventaris ada dalam kendali kamu hari ini.',
  admin: 'Operasional gudang, stok, dan laporan menanti untuk dikelola.',
  karyawan: 'Semangat kerja hari ini — cek tugas dan pengiriman kamu di bawah.',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Kartu sapaan animasi di puncak dashboard — "Selamat datang, {nama}"
 * lengkap dengan jam berjalan & dekorasi bertema pergudangan (forklift,
 * pallet, rak, kotak) yang melayang pelan di latar.
 */
export function WelcomeBanner({ fullName, role }: WelcomeBannerProps): React.JSX.Element {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Waktu hanya boleh diambil di client (menghindari mismatch SSR), jadi
    // nilai awal null lalu diisi sekali di sini — bukan pola yang dicegah
    // aturan react-hooks/set-state-in-effect (bukan reaksi ke state lain).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const firstName = fullName.split(' ')[0] ?? fullName;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      className="relative overflow-hidden rounded-lg bg-gradient-to-r from-sidebarFrom via-accentDark to-accent px-6 py-6 text-white shadow-card sm:px-8"
    >
      {/* Dekorasi bertema gudang, melayang pelan */}
      <BoxIcon className="pointer-events-none absolute -right-2 -top-4 h-24 w-24 text-white/10 animate-wms-float-slow" />
      <ForkliftIcon className="pointer-events-none absolute right-10 bottom-0 hidden h-14 w-24 text-white/10 animate-wms-drift sm:block" />
      <PalletIcon className="pointer-events-none absolute right-56 top-1/2 hidden h-6 w-16 -translate-y-1/2 text-white/10 md:block" />
      <ShelfIcon className="pointer-events-none absolute -left-3 -bottom-6 h-28 w-24 text-white/[0.06]" />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <motion.p
            className="text-xs font-semibold uppercase tracking-wide text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {now ? formatDate(now) : '\u00A0'}
          </motion.p>
          <motion.h2
            className="mt-1 flex flex-wrap items-baseline gap-2 text-2xl font-bold sm:text-3xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <span>Selamat datang, {firstName}!</span>
            <motion.span
              aria-hidden
              className="inline-block"
              animate={{ rotate: [0, 18, -8, 18, 0] }}
              transition={{ duration: 1.4, delay: 0.6, repeat: Infinity, repeatDelay: 3.5 }}
            >
              👋
            </motion.span>
          </motion.h2>
          <motion.p
            className="mt-1 text-sm text-white/80"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {ROLE_SUBTITLE[role]}
          </motion.p>
        </div>

        <motion.div
          className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 18 }}
        >
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            {ROLE_LABEL[role]}
          </span>
          <span className="text-lg font-bold tabular-nums">{now ? formatTime(now) : '--:--'}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
