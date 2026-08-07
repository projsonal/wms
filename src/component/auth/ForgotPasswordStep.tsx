'use client';

import { useState } from 'react';
import { OtpInput } from '@/component/auth/OtpInput';
import { Button } from '@/component/ui/Button';
import { Input } from '@/component/ui/FormControls';
import { authApi } from '@/lib/api/auth';
import { HttpError } from '@/lib/api/client';
import type { PasswordResetMethod } from '@/types';

type Phase = 'request' | 'otp' | 'newPassword' | 'done';

interface ForgotPasswordStepProps {
  /** Username yang sudah diketik di form login, dipakai sebagai nilai awal. */
  initialIdentifier?: string;
  onBackToLogin: () => void;
}

/**
 * Alur mandiri "Lupa Password": minta OTP lewat WhatsApp/SMS -> verifikasi
 * OTP -> set password baru -> selesai. Dikelola sebagai satu komponen
 * dengan state internal sendiri supaya wizard login (login/page.tsx) tidak
 * perlu tahu detail langkah-langkahnya, hanya render/lepas komponen ini.
 */
export function ForgotPasswordStep({
  initialIdentifier = '',
  onBackToLogin,
}: ForgotPasswordStepProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [method, setMethod] = useState<PasswordResetMethod>('whatsapp');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(): Promise<void> {
    setError(null);
    if (!identifier.trim()) {
      setError('Masukkan username atau email akun kamu terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authApi.requestPasswordReset({ identifier: identifier.trim(), method });
      setResetToken(res.resetToken);
      setPhase('otp');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal mengirim kode OTP, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(): Promise<void> {
    setError(null);
    if (otp.length < 6) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authApi.verifyPasswordResetOtp({ resetToken, otpCode: otp });
      setResetToken(res.resetToken);
      setPhase('newPassword');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Kode OTP salah atau kedaluwarsa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(): Promise<void> {
    setError(null);
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ resetToken, newPassword, newPasswordConfirmation });
      setPhase('done');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal menyimpan password baru, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === 'request') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h2 className="text-base font-semibold text-text">Lupa Password</h2>
          <p className="mt-1 text-xs text-textMuted">
            Masukkan username atau email akun kamu. Kami akan kirim kode OTP untuk verifikasi
            sebelum kamu bisa membuat password baru.
          </p>
        </div>
        <Input
          id="forgot-identifier"
          label="Username atau Email"
          placeholder="Masukkan username atau email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoFocus
        />
        <div className="flex flex-col gap-2 text-left">
          <span className="text-xs font-medium text-textMuted">Kirim kode lewat</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('whatsapp')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                method === 'whatsapp'
                  ? 'border-accent bg-accentSoft text-accentDark'
                  : 'border-borderSoft text-textMuted hover:border-accent/50'
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setMethod('sms')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                method === 'sms'
                  ? 'border-accent bg-accentSoft text-accentDark'
                  : 'border-borderSoft text-textMuted hover:border-accent/50'
              }`}
            >
              SMS
            </button>
          </div>
        </div>
        {error ? <p className="text-xs text-dangerText">{error}</p> : null}
        <Button onClick={handleRequestOtp} disabled={isSubmitting}>
          Kirim Kode OTP
        </Button>
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs text-textMuted underline"
        >
          ← Kembali ke halaman masuk
        </button>
      </div>
    );
  }

  if (phase === 'otp') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h2 className="text-base font-semibold text-text">Verifikasi Kode OTP</h2>
          <p className="mt-1 text-xs text-textMuted">
            Masukkan 6 digit kode yang dikirim lewat {method === 'whatsapp' ? 'WhatsApp' : 'SMS'} ke
            nomor terdaftar.
          </p>
        </div>
        <OtpInput value={otp} onChange={setOtp} />
        {error ? <p className="text-xs text-dangerText">{error}</p> : null}
        <Button onClick={handleVerifyOtp} disabled={isSubmitting || otp.length < 6}>
          Verifikasi
        </Button>
        <button
          type="button"
          onClick={() => {
            setOtp('');
            setPhase('request');
          }}
          className="text-xs text-textMuted underline"
        >
          ← Ganti nomor / kirim ulang
        </button>
      </div>
    );
  }

  if (phase === 'newPassword') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h2 className="text-base font-semibold text-text">Buat Password Baru</h2>
          <p className="mt-1 text-xs text-textMuted">Minimal 8 karakter.</p>
        </div>
        <Input
          id="new-password"
          label="Password Baru"
          type="password"
          placeholder="Masukkan password baru"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoFocus
        />
        <Input
          id="new-password-confirmation"
          label="Konfirmasi Password"
          type="password"
          placeholder="Ulangi password baru"
          value={newPasswordConfirmation}
          onChange={(event) => setNewPasswordConfirmation(event.target.value)}
        />
        {error ? <p className="text-xs text-dangerText">{error}</p> : null}
        <Button onClick={handleResetPassword} disabled={isSubmitting}>
          Simpan Password Baru
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-successBg text-2xl text-successText">
        ✓
      </span>
      <h2 className="text-base font-semibold text-text">Password Berhasil Diubah</h2>
      <p className="text-xs text-textMuted">
        Silakan masuk kembali menggunakan password barumu.
      </p>
      <Button onClick={onBackToLogin} className="w-full">
        Ke Halaman Masuk
      </Button>
    </div>
  );
}
