'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthShell } from '@/component/auth/AuthShell';
import { AuthTabs } from '@/component/auth/AuthTabs';
import { RegisterStep } from '@/component/auth/RegisterStep';
import { RoleSelectStep } from '@/component/auth/RoleSelectStep';
import { CaptchaField } from '@/component/auth/CaptchaField';
import { VerifySuccessStep } from '@/component/auth/VerifyResultStep';
import { Button } from '@/component/ui/Button';
import { authApi } from '@/lib/api/auth';
import { captchaApi } from '@/lib/api/security';
import { HttpError } from '@/lib/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useEnterToSubmit } from '@/lib/hooks/use-enter-to-submit';
import type { CaptchaChallenge, RegisterPayload, SessionInfo, UserRole } from '@/types';

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
 * Aplikasi internal perusahaan: TIDAK ada lagi verifikasi 2FA wajib saat
 * daftar — akun baru langsung aktif & langsung login begitu form
 * disubmit. 2FA tetap tersedia tapi jadi opsional, diaktifkan sendiri
 * lewat Settings -> Keamanan kapan pun user mau.
 *
 * Captcha GAMBAR (BUKAN humancheck seperti Lupa Password/Ubah Password —
 * lihat catatan di lib/api/security.ts) TETAP wajib di sini karena
 * backend memang mewajibkannya (RegisterRequest.CaptchaToken/CaptchaAnswer
 * validate:"required", lihat internal/controller/auth/struct.go). SEBELUM
 * PERBAIKAN INI, UI captcha-nya hilang dari halaman ini padahal backend
 * tetap mewajibkan field itu terisi — akibatnya form SELALU gagal
 * validasi ("validasi gagal") apa pun yang diisi user, karena
 * captchaToken/captchaAnswer yang dikirim selalu string kosong.
 */
export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<RegisterPayload>(EMPTY_FORM);
  const [role, setRole] = useState<UserRole>('karyawan');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | undefined>(undefined);

  async function loadCaptcha(): Promise<void> {
    setIsRefreshingCaptcha(true);
    try {
      const c = await captchaApi.generate();
      setChallenge(c);
      setCaptchaAnswer('');
    } catch {
      setFormError('Gagal memuat captcha — cek koneksi ke server backend.');
    } finally {
      setIsRefreshingCaptcha(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadCaptcha async
    loadCaptcha();
  }, []);

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    setFieldErrors({});
    if (!challenge) {
      setFormError('Captcha belum siap, tunggu sebentar lalu coba lagi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authApi.register({
        ...form,
        roleName: role,
        captchaToken: challenge.captchaToken,
        captchaAnswer,
      });
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
      // Captcha lama (kalau sempat kepakai/salah) sudah tidak valid lagi
      // di backend — muat ulang supaya percobaan berikutnya pakai token baru.
      await loadCaptcha();
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
          <CaptchaField
            challenge={challenge}
            answer={captchaAnswer}
            onAnswerChange={setCaptchaAnswer}
            onRefresh={loadCaptcha}
            isRefreshing={isRefreshingCaptcha}
          />
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
