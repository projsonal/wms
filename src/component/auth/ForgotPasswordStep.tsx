'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/component/ui/Button';
import { Input, PasswordInput } from '@/component/ui/FormControls';
import { CaptchaField } from '@/component/auth/CaptchaField';
import { authApi } from '@/lib/api/auth';
import { captchaApi } from '@/lib/api/security';
import { HttpError } from '@/lib/api/client';
import { Icon } from "@iconify/react";
import type { CaptchaChallenge } from '@/types';

interface ForgotPasswordStepProps {
  initialIdentifier?: string;
  onBackToLogin: () => void;
}

export function ForgotPasswordStep({
  initialIdentifier = '',
  onBackToLogin,
}: Readonly<ForgotPasswordStepProps>): React.JSX.Element {
  const [phase, setPhase] = useState<'form' | 'done'>('form');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadCaptcha(): Promise<void> {
    setIsRefreshingCaptcha(true);
    try {
      const c = await captchaApi.generate();
      setChallenge(c);
      setCaptchaAnswer('');
      setError(null);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Gagal memuat captcha...',
      );
    } finally {
      setIsRefreshingCaptcha(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function handleSubmit(): Promise<void> {
    setError(null);
    if (!identifier.trim()) {
      setError('Masukkan username akun kamu terlebih dahulu.');
      return;
    }
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
      await authApi.resetPassword({
        identifier: identifier.trim(),
        newPassword,
        newPasswordConfirmation,
        captchaToken: challenge?.captchaToken ?? '',
        captchaAnswer,
      });
      setPhase('done');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal menyimpan password baru, coba lagi.');
      await loadCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === 'form') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h2 className="text-base font-semibold text-text">Lupa Password</h2>
          <p className="mt-1 text-xs text-textMuted">
            Masukkan password baru. Selesaikan captcha untuk
            memverifikasi bahwa kamu bukan robot.
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
        <CaptchaField
          challenge={challenge}
          answer={captchaAnswer}
          onAnswerChange={setCaptchaAnswer}
          onRefresh={loadCaptcha}
          isRefreshing={isRefreshingCaptcha}
        />
        {error ? <p className="text-xs text-dangerText">{error}</p> : null}
        <Button onClick={handleSubmit} loading={isSubmitting}>
          Ganti Password
        </Button>
        <button type="button" onClick={onBackToLogin} className="text-xs text-textMuted underline">
          <Icon
            icon="lucide:arrow-left"
            className="h-4 w-4"
            aria-hidden="true"
            />
            Kembali ke halaman masuk
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-successBg text-2xl text-successText">
        ✓
      </span>
      <h2 className="text-base font-semibold text-text">Password Berhasil Diubah</h2>
      <p className="text-xs text-textMuted">Silakan masuk kembali menggunakan password barumu.</p>
      <Button onClick={onBackToLogin} className="w-full">
        Ke Halaman Masuk
      </Button>
    </div>
  );
}
