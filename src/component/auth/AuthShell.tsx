'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
  footer?: ReactNode;
  step?: number;
  totalSteps?: number;
}

export function AuthShell({
  children,
  footer,
  step = 1,
  totalSteps = 4,
}: AuthShellProps): React.JSX.Element {
  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-white px-4 py-16">
      <span className="pointer-events-none absolute left-6 top-4 h-24 w-32 rounded-[60%_40%_55%_45%/50%_60%_40%_50%] bg-sidebarFrom animate-wms-float-slow" />
      <span className="pointer-events-none absolute right-10 top-24 h-14 w-14 rounded-[50%_50%_60%_40%/40%_50%_50%_60%] border-4 border-sidebarFrom animate-wms-float" />
      <span className="pointer-events-none absolute bottom-10 right-14 h-16 w-16 rounded-[55%_45%_50%_50%/45%_55%_50%_50%] border-4 border-sidebarFrom animate-wms-float-delay" />
      <span className="pointer-events-none absolute bottom-16 right-40 h-40 w-32 rounded-[55%_45%_60%_40%/50%_55%_45%_50%] bg-sidebarFrom animate-wms-float-slow" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <motion.div
          className="mb-[-40px] flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-neutralBg shadow-card"
          initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <Image src="/assets/stockrsdLogo.png" alt="Logo StokRSD WMS" width={112} height={112} priority />
        </motion.div>
        <motion.div
          className="w-full overflow-hidden rounded-lg bg-surfaceAlt shadow-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.1 }}
        >
          <div className="px-8 pb-8 pt-16 text-center">
            <h1 className="text-lg font-semibold text-text">StokRSD WMS</h1>
            <p className="text-sm text-textMuted">Masuk untuk kelola gudang</p>
          </div>
          <div className="px-8 pb-8">{children}</div>
          {footer ? (
            <div className="relative rounded-t-[40%_40%_0_0/60px_60px_0_0] bg-accentDark px-8 pb-8 pt-10">
              {footer}
              <div className="mt-5 flex justify-center gap-1.5">
                {Array.from({ length: totalSteps }, (_, index) => index + 1).map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-1.5 w-1.5 rounded-full bg-white"
                    animate={{ opacity: dot === step ? 1 : 0.4, scale: dot === step ? 1.3 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
