'use client';

import { motion } from 'framer-motion';
import { Button } from '@/component/ui/Button';
import { fadeUp } from '@/component/ui/motion';
import type { SessionInfo } from '@/types';

interface VerifySuccessStepProps {
  session?: SessionInfo;
  onFinish: () => void;
}

export function VerifySuccessStep({ session, onFinish }: Readonly<VerifySuccessStepProps>): React.JSX.Element {
  const rows: [string, string][] = [
    ['Browser', session ? `${session.browser} ${session.browserVersion}`.trim() : '-'],
    ['Sistem Operasi', session ? `${session.os} ${session.osVersion}`.trim() : '-'],

    ['Alamat IP', session?.ipAddress || '-'],
    ['Lokasi', session?.location || '-'],
  ];

  return (
    <div className="flex flex-col gap-4 text-center">
      <motion.h2
        className="flex items-center justify-center gap-2 text-base font-semibold text-text"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span aria-hidden className="text-dangerText">
          🛡
        </span>
        Verifikasi Identitas Kamu
      </motion.h2>
      <p className="text-xs text-textMuted">
        Verifikasi yang kamu lakukan selesai, silakan akses akun kamu.
      </p>
      <div className="flex justify-center">
        <motion.span
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-successBg text-2xl text-successText"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        >
          <span className="absolute inset-0 rounded-full animate-wms-glow-pulse" />
          <span className="relative">✓</span>
        </motion.span>
      </div>
      <motion.p
        className="text-sm font-semibold text-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        Verifikasi OTP Berhasil
      </motion.p>
      <dl className="flex flex-col gap-2 rounded-md bg-neutralBg p-4 text-left text-xs">
        {rows.map(([label, value], index) => (
          <motion.div
            key={label}
            className="flex items-center justify-between"
            custom={index}
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <dt className="text-textMuted">{label}</dt>
            <dd className="font-semibold text-text">{value}</dd>
          </motion.div>
        ))}
      </dl>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button onClick={onFinish} className="w-full">
          Selesaikan Login
        </Button>
      </motion.div>
    </div>
  );
}

interface VerifyFailedStepProps {
  onRetry: () => void;
  onBack: () => void;
}

export function VerifyFailedStep({ onRetry, onBack }: Readonly<VerifyFailedStepProps>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="text-base font-semibold text-text">Verifikasi Gagal</h2>
      <p className="text-xs text-textMuted">Kode OTP salah atau sudah kedaluwarsa. Silakan coba lagi dengan kode yang baru</p>
      <div className="flex justify-center">
        <motion.span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-dangerBg text-2xl text-dangerText"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.15, 1], rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.5 }}
        >
          ✕
        </motion.span>
      </div>
      <p className="text-xs text-textMuted">Silakan coba lagi untuk lakukan scan barcode.</p>
      <div className="flex gap-3">
        <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="secondary" className="w-full" onClick={onRetry}>
            Coba Lagi
          </Button>
        </motion.div>
        <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button className="w-full" onClick={onBack}>
            Kembali
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
