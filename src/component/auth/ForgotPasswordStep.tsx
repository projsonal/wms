'use client';

import { useState } from 'react';
import { Button } from '@/component/ui/Button';
import { Input, PasswordInput } from '@/component/ui/FormControls';
import { HumanCheckField } from '@/component/auth/HumanCheckField';
import { authApi } from '@/lib/api/auth';
import { HttpError } from '@/lib/api/client';
import { CheckCircle2 } from 'lucide-react';


interface ForgotPasswordStepProps {
  initialIdentifier?: string;
  onBackToLogin: (justResetPassword?: boolean) => void;
}

// Alur lupa password satu langkah (username + password baru), TANPA kode
// OTP WhatsApp — fitur OTP WhatsApp untuk reset password (kirim kode 6
// digit ke nomor terdaftar sebagai bukti kepemilikan akun) sudah dihapus
// sepenuhnya dari sistem ini atas permintaan eksplisit pemilik sistem,
// karena pengiriman OTP via WhatsApp tidak bisa diandalkan di lingkungan
// ini. Ini sekarang satu-satunya alur lupa password yang tersedia.
//
// PERINGATAN: alur ini TIDAK membuktikan kepemilikan akun — siapa pun yang
// tahu/menebak username bisa mengganti passwordnya lewat sini selama lolos
// verifikasi "bukan robot".
type Phase = 'request' | 'done';

export function ForgotPasswordStep({
  initialIdentifier = '',
  onBackToLogin,
}: Readonly<ForgotPasswordStepProps>): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [humanCheckToken, setHumanCheckToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    if (!identifier.trim()) {
      return 'Masukkan username akun kamu terlebih dahulu.';
    }
    if (newPassword.length < 8) {
      return 'Password baru minimal 8 karakter.';
    }
    if (newPassword !== newPasswordConfirmation) {
      return 'Konfirmasi password tidak sama.';
    }
    if (!humanCheckToken) {
      return 'Tunggu proses verifikasi "kamu bukan robot" selesai terlebih dulu.';
    }
    return null;
  }

  async function handleSubmit(): Promise<void> {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword({
        identifier: identifier.trim(),
        newPassword,
        newPasswordConfirmation,
        humanCheckToken: humanCheckToken as string,
      });
      setPhase('done');
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : 'Gagal mengganti password, silakan coba lagi.',
      );
      setHumanCheckToken(null);
      setResetKey((k) => k + 1);
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
            Masukkan username akun kamu beserta password baru yang ingin dipakai.
          </p>
        </div>
        <Input
          id="forgot-identifier"
          label="Username"
          placeholder="Masukkan username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoFocus
        />
        <PasswordInput
          id="forgot-new-password"
          label="Password Baru"
          placeholder="Minimal 8 karakter"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordInput
          id="forgot-new-password-confirmation"
          label="Konfirmasi Password Baru"
          placeholder="Ulangi password baru"
          value={newPasswordConfirmation}
          onChange={(event) => setNewPasswordConfirmation(event.target.value)}
        />
        <HumanCheckField
          resetKey={resetKey}
          onVerified={setHumanCheckToken}
          onReset={() => setHumanCheckToken(null)}
        />
        {error ? <p className="text-xs text-dangerText">{error}</p> : null}
        <Button onClick={handleSubmit} loading={isSubmitting} disabled={!humanCheckToken}>
          Ganti Password
        </Button>
        <button type="button" onClick={() => onBackToLogin()} className="text-xs text-textMuted underline">
          Sudah ingat password? Kembali ke halaman masuk
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-successBg text-2xl text-successText">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-text">Password Berhasil Diubah</h2>
      <p className="text-xs text-textMuted">Silakan masuk kembali menggunakan password barumu.</p>
      <Button onClick={() => onBackToLogin(true)} className="w-full">
        Ke Halaman Masuk
      </Button>
    </div>
  );
}
