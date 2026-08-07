'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarcodeIcon,
  BoxIcon,
  CheckBurstIcon,
  ForkliftIcon,
} from '@/component/ui/WarehouseIcons';

interface WelcomeTransitionProps {
  name: string;
  roleLabel: string;
  onDone: () => void;
}

/**
 * Layar transisi penuh setelah login berhasil: forklift "menjemput" sesi,
 * lalu memindai barcode, lalu menampilkan sapaan "Selamat datang, {name}"
 * sebelum halaman dashboard terlihat. Dipanggil sekali per login lewat
 * flag di sessionStorage (lihat `login/page.tsx` & `dashboard/page.tsx`).
 */
export function WelcomeTransition({ name, roleLabel, onDone }: WelcomeTransitionProps): React.JSX.Element {
  const [phase, setPhase] = useState<'scan' | 'greet'>('scan');

  useEffect(() => {
    const toGreet = setTimeout(() => setPhase('greet'), 1500);
    const finish = setTimeout(() => onDone(), 3400);
    return () => {
      clearTimeout(toGreet);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-gradient-to-br from-sidebarFrom via-accentDark to-sidebarTo text-white"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Dekorasi kotak melayang di latar */}
      <BoxIcon className="pointer-events-none absolute left-[8%] top-[16%] h-16 w-16 text-white/15 animate-wms-float" />
      <BoxIcon className="pointer-events-none absolute right-[10%] top-[20%] h-10 w-10 text-white/10 animate-wms-float-delay" />
      <BoxIcon className="pointer-events-none absolute left-[14%] bottom-[20%] h-12 w-12 text-white/10 animate-wms-float-slow" />
      <BoxIcon className="pointer-events-none absolute right-[16%] bottom-[26%] h-20 w-20 text-white/10 animate-wms-float" />

      {/* Sabuk konveyor di dasar layar */}
      <div className="absolute inset-x-0 bottom-0 h-14 overflow-hidden bg-black/25">
        <div className="h-full w-full animate-wms-conveyor bg-[length:80px_100%] opacity-70" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {phase === 'scan' ? (
          <motion.div
            key="scan"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-5"
          >
            <motion.div
              animate={{ x: [0, 16, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ForkliftIcon className="h-16 w-28 text-white drop-shadow-lg" />
            </motion.div>
            <div className="relative overflow-hidden rounded-xl border border-white/25 bg-white/10 px-6 py-4 backdrop-blur-sm">
              <BarcodeIcon className="h-8 w-32 text-white/85" />
              <motion.span className="absolute inset-x-0 top-0 h-0.5 bg-accentSoft animate-wms-scan" />
            </div>
            <motion.p
              className="text-sm text-white/70"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              Memverifikasi sesi &amp; menyiapkan gudang kamu...
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="greet"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            >
              <CheckBurstIcon className="h-16 w-16 text-white" />
            </motion.div>
            <motion.h1
              className="text-2xl font-bold sm:text-4xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              Selamat datang, {name}! 👋
            </motion.h1>
            <motion.p
              className="text-sm text-white/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Masuk sebagai {roleLabel} • Menyiapkan dashboard gudang kamu...
            </motion.p>
            <motion.div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.7, ease: 'easeInOut', delay: 0.1 }}
              />
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
