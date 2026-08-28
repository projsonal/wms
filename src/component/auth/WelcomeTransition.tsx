'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface WelcomeTransitionProps {
  name: string;
  roleLabel: string;
  onDone: () => void;
}

const PARTICLE_COUNT = 14;

export function WelcomeTransition({ name, roleLabel, onDone }: Readonly<WelcomeTransitionProps>): React.JSX.Element {
  const [phase, setPhase] = useState<'reveal' | 'greet'>('reveal');

  useEffect(() => {
    const toGreet = setTimeout(() => setPhase('greet'), 1700);
    const finish = setTimeout(() => onDone(), 3800);
    return () => {
      clearTimeout(toGreet);
      clearTimeout(finish);
    };
  }, [onDone]);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: 8 + ((i * 6.5) % 84),
        delay: (i % 7) * 0.55,
        duration: 3.4 + (i % 5) * 0.4,
        size: 2 + (i % 3),
      })),
    [],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#050505] text-white"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,160,74,0.16)_0%,rgba(212,160,74,0)_70%)]" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]" />

      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute bottom-0 rounded-full bg-[#d4a04a] animate-wms-particle-rise"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            boxShadow: '0 0 6px rgba(212,160,74,0.8)',
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-7 px-6 text-center">
        {phase === 'reveal' ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden"
            >
              <Image
                src="/assets/logo_wms.jpg"
                alt="Logo WMS-RSD"
                width={220}
                height={124}
                priority
                className="block h-auto w-52 select-none sm:w-64"
              />

              <motion.div
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                initial={{ x: '-120%', skewX: -12 }}
                animate={{ x: '220%' }}
                transition={{ duration: 1.3, delay: 0.5, ease: 'easeInOut' }}
              />
            </motion.div>

            <motion.div
              className="h-px bg-gradient-to-r from-transparent via-[#d4a04a] to-transparent"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />

            <motion.p
              className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/50"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              Menyiapkan Gudang Anda
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="greet"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image
                src="/assets/logo_wms.jpg"
                alt="Logo WMS-RSD"
                width={132}
                height={74}
                className="mx-auto h-auto w-32 select-none opacity-90 sm:w-36"
              />
            </motion.div>
            <motion.h1
              className="text-xl font-semibold tracking-wide text-white sm:text-3xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              Selamat Datang, {name}
            </motion.h1>
            <motion.p
              className="text-xs uppercase tracking-[0.3em] text-[#d4a04a]/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              {roleLabel}
            </motion.p>
            <motion.div
              className="mt-3 h-px w-56 overflow-hidden bg-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-[#d4a04a] via-[#f3d9ce] to-[#d4a04a]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.9, ease: 'easeInOut', delay: 0.2 }}
              />
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
