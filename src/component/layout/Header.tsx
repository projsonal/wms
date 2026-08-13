'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SidebarMobileToggle } from '@/component/layout/Sidebar';

interface HeaderProps {
  title: string;
  breadcrumb: string;
  action?: ReactNode;
}

/**
 * Header judul halaman + breadcrumb, ditampilkan di atas konten setiap
 * halaman dashboard. Bagian dari kerangka layout (bersama Sidebar & Footer),
 * karena itu ditempatkan di `component/layout`, bukan `component/ui`.
 */
export function Header({ title, breadcrumb, action }: HeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-borderSoft bg-surface px-4 py-4 sm:px-6 lg:px-8 lg:py-5 print:hidden">
      <div className="flex items-center gap-3">
        <SidebarMobileToggle />
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        >
          <h1 className="text-lg font-bold text-text sm:text-2xl">{title}</h1>
          <p className="text-xs text-textMuted sm:text-sm">{breadcrumb}</p>
        </motion.div>
      </div>
      {action ? (
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.05 }}
        >
          {action}
        </motion.div>
      ) : null}
    </header>
  );
}
