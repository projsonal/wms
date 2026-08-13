'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AuthShell } from '@/component/auth/AuthShell';
import { AuthTabs } from '@/component/auth/AuthTabs';
import { RegisterStep } from '@/component/auth/RegisterStep';
import { RoleSelectStep } from '@/component/auth/RoleSelectStep';
import { VerifySuccessStep } from '@/component/auth/VerifyResultStep';
import { Button } from '@/component/ui/Button';
import { authApi } from '@/lib/api/auth';
import { HttpError } from '@/lib/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useEnterToSubmit } from '@/lib/hooks/use-enter-to-submit';
import type { RegisterPayload, SessionInfo, UserRole } from '@/types';

type Step = 'form' | 'success';

const EMPTY_FORM: RegisterPayload = {
  username: '',
  password: '',
  passwordConfirmation: '',
  fullName: '',
  phoneNumber: '',
  roleName: 'karyawan',
  captchaToken: '',
  captchaAnswer: '',
};

/**
 * Aplikasi internal perusahaan: TIDAK ada lagi captcha yang ditampilkan
 * (backend menerima captcha kosong — lihat RegisterRequest.CaptchaToken
 * di gowms) dan TIDAK ada lagi verifikasi 2FA wajib saat daftar. Akun
 * baru langsung aktif & langsung login begitu form disubmit. 2FA tetap
 * tersedia tapi jadi opsional, diaktifkan sendiri lewat
 * Settings -> Keamanan kapan pun user mau.
 */
export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<RegisterPayload>(EMPTY_FORM);
  const [role, setRole] = useState<UserRole>('karyawan');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | undefined>(undefined);

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await authApi.register({ ...form, roleName: role });
      setSessionInfo(res.session);
      setStep('success');
      toast.success('Pendaftaran akun berhasil! Selamat datang di WMS-RSD.');
    } catch (error) {
      if (error instanceof HttpError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setFormError('Pendaftaran gagal, silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finalizeLogin(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('wms_show_welcome', '1');
    }
    await refreshUser();
    router.push('/home/dashboard');
  }

  const handleAuthShellKeyDown = useEnterToSubmit(handleSubmit, {
    disabled: isSubmitting || step !== 'form',
  });

  return (
    <AuthShell step={1} totalSteps={1} onKeyDown={handleAuthShellKeyDown}>
      {step === 'form' ? (
        <div className="flex flex-col gap-4">
          <AuthTabs active="register" />
          <RoleSelectStep selectedRole={role} onSelectRole={setRole} />
          <RegisterStep values={form} errors={fieldErrors} onChange={setForm} />
          {formError ? <p className="text-xs text-dangerText">{formError}</p> : null}
          <Button onClick={handleSubmit} loading={isSubmitting}>
            Daftar
          </Button>
        </div>
      ) : (
        <VerifySuccessStep session={sessionInfo} onFinish={finalizeLogin} />
      )}
    </AuthShell>
  );
}
