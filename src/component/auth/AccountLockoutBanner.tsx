'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AccountLockoutBannerProps {
  /** Pesan mentah dari server, mis. "akun anda dikunci sementara karena
   * terlalu banyak percobaan gagal, coba lagi dalam setelah 5 menit". */
  message: string;
  /** Dipanggil sekali saat hitung mundur mencapai nol, supaya form login
   * bisa dibuka kembali otomatis. */
  onExpire?: () => void;
}

const UNIT_TO_SECONDS: Record<string, number> = { detik: 1, menit: 60, jam: 3600 };

/**
 * Cari angka + satuan waktu (menit/detik/jam) di pesan server, dan ubah ke
 * detik. Diparsing lewat pemecahan kata (bukan satu regex kompleks) supaya
 * tidak rentan backtracking super-linear (aturan sonarjs/slow-regex).
 */
function parseLockoutSeconds(message: string): number | null {
  const words = message.toLowerCase().split(/[^a-z0-9]+/);
  for (let i = 0; i < words.length; i += 1) {
    const unitSeconds = UNIT_TO_SECONDS[words[i]];
    if (unitSeconds && i > 0 && /^\d+$/.test(words[i - 1])) {
      return Number(words[i - 1]) * unitSeconds;
    }
  }
  return null;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

/**
 * Deteksi pesan lockout akun dari backend (mis. "dikunci sementara ...
 * coba lagi dalam N menit") dan tampilkan sebagai hitung mundur hidup
 * dengan animasi jam pasir, bukan cuma teks statis.
 */
export function AccountLockoutBanner({ message, onExpire }: AccountLockoutBannerProps): React.JSX.Element {
  const initialSeconds = parseLockoutSeconds(message) ?? 60;
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat pesan lockout baru datang (prop berubah)
    setSecondsLeft(parseLockoutSeconds(message) ?? 60);
  }, [message]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft, onExpire]);

  const progressPercent = Math.min(100, (secondsLeft / initialSeconds) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-md border border-dangerBg bg-dangerBg/40 p-4"
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dangerBg text-lg"
          animate={{ rotate: [0, 180, 360] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        >
          ⏳
        </motion.span>
        <div>
          <p className="text-sm font-semibold text-dangerText">Akun terkunci sementara</p>
          <p className="text-xs text-textMuted">Terlalu banyak percobaan masuk gagal.</p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <motion.span
          key={secondsLeft}
          initial={{ scale: 1.15, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="text-3xl font-bold tabular-nums text-dangerText"
        >
          {formatDuration(secondsLeft)}
        </motion.span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dangerBg">
        <motion.div
          className="h-full rounded-full bg-dangerText"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.9, ease: 'linear' }}
        />
      </div>

      <p className="text-center text-xs text-textMuted">
        Kamu bisa coba masuk lagi otomatis setelah waktu ini habis.
      </p>
    </motion.div>
  );
}
