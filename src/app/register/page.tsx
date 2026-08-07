'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/component/auth/AuthShell';
import { CaptchaGate, useRunWithBotGate } from '@/component/auth/CaptchaGate';
import { RegisterStep } from '@/component/auth/RegisterStep';
import { RoleSelectStep } from '@/component/auth/RoleSelectStep';
import { TwoFactorSetupStep } from '@/component/auth/TwoFactorSetupStep';
import { VerifyFailedStep, VerifySuccessStep } from '@/component/auth/VerifyResultStep';
import { Button } from '@/component/ui/Button';
import { authApi } from '@/lib/api/auth';
import { captchaApi } from '@/lib/api/security';
import { HttpError } from '@/lib/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { CaptchaChallenge, RegisterPayload, SessionInfo, UserRole } from '@/types';

type Step = 'form' | 'setup2fa' | 'success' | 'failed';

const STEP_INDEX: Record<Step, number> = { form: 1, setup2fa: 2, success: 3, failed: 3 };

const EMPTY_FORM: RegisterPayload = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  fullName: '',
  phoneNumber: '',
  roleName: 'karyawan',
  captchaToken: '',
  captchaAnswer: '',
};

function RegisterWizard(): React.JSX.Element {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const runWithBotGate = useRunWithBotGate();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<RegisterPayload>(EMPTY_FORM);
  const [role, setRole] = useState<UserRole>('karyawan');
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingToken, setPendingToken] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | undefined>(undefined);

  async function loadCaptcha(): Promise<void> {
    try {
      const challenge = await runWithBotGate(() => captchaApi.generate());
      setCaptcha(challenge);
    } catch {
      // Gerbang anti-bot menampilkan captcha-nya sendiri kalau ini gagal karena bot-token;
      // untuk error lain, biarkan pengguna coba tombol muat-ulang pada CaptchaField.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadCaptcha async, lihat AuthContext untuk pola serupa
    loadCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya dijalankan sekali saat mount
  }, []);

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    setFieldErrors({});
    if (!captcha) {
      setFormError('Captcha belum siap, tunggu sebentar lalu coba lagi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await runWithBotGate(() =>
        authApi.register({ ...form, roleName: role, captchaToken: captcha.captchaToken }),
      );
      setPendingToken(res.pendingToken ?? '');
      const setup = await runWithBotGate(() => authApi.setupTwoFactor(res.pendingToken ?? ''));
      setTotpSecret(setup.secret);
      setStep('setup2fa');
    } catch (error) {
      if (error instanceof HttpError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setFormError('Pendaftaran gagal, silakan coba lagi.');
      }
      await loadCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmSetup2FA(): Promise<void> {
    setIsSubmitting(true);
    try {
      const res = await runWithBotGate(() =>
        authApi.confirmTwoFactorSetup({ pendingToken, secret: totpSecret, otpCode: otp }),
      );
      setSessionInfo(res.session);
      setStep('success');
    } catch {
      setStep('failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshTwoFactorSetup(): Promise<void> {
    try {
      const setup = await runWithBotGate(() => authApi.setupTwoFactor(pendingToken));
      setTotpSecret(setup.secret);
      setOtp('');
    } catch (error) {
      setFormError(error instanceof HttpError ? error.message : 'Gagal memuat ulang kode QR.');
    }
  }

  async function finalizeLogin(): Promise<void> {
    await refreshUser();
    router.push('/dashboard');
  }

  function renderStep(): React.JSX.Element {
    switch (step) {
      case 'form':
        return (
          <div className="flex flex-col gap-4">
            <RoleSelectStep selectedRole={role} onSelectRole={setRole} />
            <RegisterStep
              values={form}
              errors={fieldErrors}
              onChange={setForm}
              captcha={captcha}
              onRefreshCaptcha={loadCaptcha}
            />
            {formError ? <p className="text-xs text-dangerText">{formError}</p> : null}
          </div>
        );
      case 'setup2fa':
        return (
          <TwoFactorSetupStep
            secret={totpSecret}
            accountLabel={form.username}
            otp={otp}
            onOtpChange={setOtp}
            onCancel={() => setStep('form')}
            onActivate={handleConfirmSetup2FA}
            isSubmitting={isSubmitting}
            onExpire={refreshTwoFactorSetup}
          />
        );
      case 'success':
        return <VerifySuccessStep session={sessionInfo} onFinish={finalizeLogin} />;
      case 'failed':
        return (
          <VerifyFailedStep
            onRetry={() => {
              setOtp('');
              setStep('setup2fa');
            }}
            onBack={() => setStep('form')}
          />
        );
      default:
        return <p />;
    }
  }

  function renderFooter(): React.JSX.Element | null {
    if (step !== 'form') {
      return null;
    }
    return (
      <>
        <p className="mb-3 text-center text-xs text-white/80">Sudah punya akun?</p>
        <Link href="/login">
          <Button variant="secondary" className="mb-3 w-full !border-white/40 !bg-transparent !text-white">
            Masuk
          </Button>
        </Link>
        <Button className="w-full !bg-white !text-accentDark" onClick={handleSubmit} disabled={isSubmitting}>
          Daftar →
        </Button>
      </>
    );
  }

  return (
    <AuthShell step={STEP_INDEX[step]} totalSteps={3} footer={renderFooter()}>
      {renderStep()}
    </AuthShell>
  );
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <CaptchaGate>
      <RegisterWizard />
    </CaptchaGate>
  );
}
