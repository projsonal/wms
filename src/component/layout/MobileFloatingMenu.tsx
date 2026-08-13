'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { getNavGroupsForRole } from '@/auth/roles';
import { useIsMobileDevice } from '@/lib/hooks/use-mobile-device';
import { useHasPageActionFab } from '@/lib/hooks/use-page-fab';

const MAX_SHORTCUTS = 5;
// Jari-jari busur (derajat) tempat satelit menyebar dari tombol utama —
// menyebar ke kiri-atas mengikuti tata letak radial di mockup Figma.
const ARC_START_DEG = 200;
const ARC_END_DEG = 280;
const RADIUS_PX = 108;

/**
 * Menu melayang berbentuk lingkaran (floating action button) khusus untuk
 * PERANGKAT mobile sungguhan (deteksi User-Agent, bukan breakpoint CSS —
 * lihat use-mobile-device.ts). Tombol utama "+" di pojok kanan bawah
 * memuai jadi busur tombol pil berisi jalan pintas navigasi saat disentuh,
 * lalu berubah jadi "x" untuk menutup — sesuai mockup radial-menu Figma.
 * Tersedia untuk SEMUA role; daftar jalan pintas menyesuaikan menu yang
 * memang bisa diakses role yang sedang login.
 */
export function MobileFloatingMenu(): React.JSX.Element | null {
  const isMobileDevice = useIsMobileDevice();
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // Halaman yang punya tabel dengan aksi (Add/Change/Delete/Export/Print/
  // Modify/Protect) sudah menampilkan FAB-nya sendiri yang lebih lengkap
  // (lihat TableRowActionBar) — jangan tumpuk dengan FAB navigasi ini.
  const hasPageActionFab = useHasPageActionFab();

  if (!isMobileDevice || !user || hasPageActionFab) {
    return null;
  }

  const shortcuts = getNavGroupsForRole(user.role)
    .flatMap((group) => group.links)
    .slice(0, MAX_SHORTCUTS);

  if (shortcuts.length === 0) {
    return null;
  }

  const step = shortcuts.length > 1 ? (ARC_END_DEG - ARC_START_DEG) / (shortcuts.length - 1) : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden print:hidden">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="backdrop"
            className="fixed inset-0 -z-10 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen
          ? shortcuts.map((link, index) => {
              const angleDeg = ARC_START_DEG + step * index;
              const angleRad = (angleDeg * Math.PI) / 180;
              const x = Math.cos(angleRad) * RADIUS_PX;
              const y = Math.sin(angleRad) * RADIUS_PX;
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <motion.div
                  key={link.href}
                  className="absolute bottom-1/2 right-1/2"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22, delay: index * 0.03 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex h-14 w-14 translate-x-1/2 translate-y-1/2 flex-col items-center justify-center rounded-full text-center text-[9px] font-semibold leading-tight shadow-lg transition-colors ${
                      isActive ? 'bg-accent text-white' : 'bg-white text-text hover:bg-accentSoft'
                    }`}
                  >
                    {link.label
                      .split(' ')
                      .slice(0, 2)
                      .map((word) => (
                        <span key={word}>{word}</span>
                      ))}
                  </Link>
                </motion.div>
              );
            })
          : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileTap={{ scale: 0.9 }}
        aria-label={isOpen ? 'Tutup menu cepat' : 'Buka menu cepat'}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-colors ${
          isOpen ? 'bg-dangerText' : 'bg-accent'
        }`}
        animate={{ rotate: isOpen ? 135 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        {!isOpen ? (
          <motion.span
            className="absolute inset-0 rounded-full bg-accent"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
      </motion.button>
    </div>
  );
}
