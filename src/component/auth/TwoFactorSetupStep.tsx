'use client';

import { useEffect, useState } from 'react';
import { OtpInput } from '@/component/auth/OtpInput';
import { Button } from '@/component/ui/Button';
import { generateTotpQrDataUrl } from '@/lib/utils/totp-qr';

const EXPIRY_SECONDS = 5 * 60;

interface TwoFactorSetupStepProps {
  /** Secret TOTP mentah dari backend — dipakai untuk generate QR di
   * browser (lihat lib/utils/totp-qr.ts) sekaligus ditampilkan sebagai
   * entri manual. Tidak lagi bergantung pada gambar QR dari backend,
   * supaya selalu tampil walau endpoint gambarnya bermasalah. */
  secret: string;
  /** Label akun yang ditempel ke QR, biasanya username. */
  accountLabel: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onCancel: () => void;
  onActivate: () => void;
  isSubmitting: boolean;
  /** Dipanggil saat kode QR kedaluwarsa (timer habis) supaya pemanggil
   * bisa minta secret baru dari backend lalu kembali ke layar generate ini. */
  onExpire?: () => void;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface QrDisplayProps {
  qrDataUrl: string;
  qrError: string | null;
  secret: string;
  onRetry?: () => void;
}

/** Area gambar QR: tampilkan hasil generate, atau status memuat/gagal/menunggu data. */
function QrDisplay({ qrDataUrl, qrError, secret, onRetry }: QrDisplayProps): React.JSX.Element {
  if (qrDataUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL hasil generate lokal, tidak perlu optimisasi Next/Image */}
        <img
          src={qrDataUrl}
          alt="QR kode aktivasi two factor authentication"
          className="h-40 w-40 rounded-md border border-borderSoft bg-white p-2"
        />
        <a
          href={qrDataUrl}
          download="stokrsd-2fa-qr.png"
          className="text-xs font-semibold text-accent underline sm:hidden"
        >
          Unduh gambar QR
        </a>
      </div>
    );
  }

  const statusText = qrError ?? (secret ? 'Membuat kode QR...' : 'Menunggu data dari server...');

  return (
    <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-borderSoft bg-neutralBg p-3 text-center">
      <span className="text-xs text-textMuted">{statusText}</span>
      {!secret && onRetry ? (
        <button type="button" onClick={onRetry} className="text-xs font-semibold text-accent underline">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function TwoFactorSetupStep({
  secret,
  accountLabel,
  otp,
  onOtpChange,
  onCancel,
  onActivate,
  isSubmitting,
  onExpire,
}: TwoFactorSetupStepProps): React.JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);
  const isExpired = secondsLeft <= 0;

  // Generate ulang QR di browser setiap kali secret berubah (mis. setelah
  // "Minta QR Baru"), dan reset timer 5:00 bersamaan.
  useEffect(() => {
    let cancelled = false;
    // Reset tampilan saat secret baru diterima dari server (prop berubah) —
    // pola sinkronisasi state lokal terhadap data eksternal, bukan reaksi
    // berantai ke state React lain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQrError(null);
    setQrDataUrl('');
    if (!secret) {
      return;
    }
    generateTotpQrDataUrl(secret, accountLabel || 'akun')
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError('Gagal membuat kode QR di perangkat ini.');
        }
      });
    setSecondsLeft(EXPIRY_SECONDS);
    return () => {
      cancelled = true;
    };
  }, [secret, accountLabel]);

  useEffect(() => {
    if (isExpired) {
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isExpired]);

  useEffect(() => {
    if (isExpired) {
      onExpire?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya dipicu sekali saat transisi ke expired
  }, [isExpired]);

  const isLowTime = secondsLeft <= 30 && secondsLeft > 0;

  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <h2 className="text-base font-semibold text-text">Aktifkan Two Factor Authentication</h2>
        <p className="mt-1 text-xs text-textMuted">
          Silahkan scan barcode menggunakan apk Authenticator google untuk memverifikasi kode OTP
          yang akan diterima.
        </p>
      </div>

      {isExpired ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dangerBg bg-dangerBg/40 p-4">
          <p className="text-sm font-semibold text-dangerText">Kode QR sudah kedaluwarsa</p>
          <p className="text-xs text-textMuted">
            Demi keamanan, silakan minta kode QR baru lalu scan ulang.
          </p>
          <Button type="button" onClick={() => onExpire?.()}>
            Minta QR Baru
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <QrDisplay qrDataUrl={qrDataUrl} qrError={qrError} secret={secret} onRetry={onExpire} />
          </div>

          {secret ? (
            <div className="flex flex-col gap-1 rounded-md bg-neutralBg p-3">
              <p className="text-xs text-textMuted">
                Tidak bisa scan? Masukkan kode ini secara manual di aplikasi Authenticator:
              </p>
              <code className="select-all break-all rounded bg-surface px-2 py-1.5 font-mono text-sm font-semibold text-text">
                {secret}
              </code>
            </div>
          ) : null}

          <p className="text-xs text-textMuted">
            Silakan masukkan kode OTP yang ada di apk tersebut di bawah, supaya akun kamu aman.
          </p>
          <OtpInput value={otp} onChange={onOtpChange} />
          <p className="text-xs text-textMuted">
            Kode ini akan kadaluarsa dalam waktu{' '}
            <span className={isLowTime ? 'font-semibold text-dangerText' : 'font-semibold text-accentDark'}>
              {formatTime(secondsLeft)}
            </span>
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
              Batalkan
            </Button>
            <Button className="flex-1" onClick={onActivate} disabled={isSubmitting || otp.length < 6}>
              Aktifkan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
