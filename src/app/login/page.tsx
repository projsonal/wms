'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountLockoutBanner } from '@/component/auth/AccountLockoutBanner';
import { AuthShell } from '@/component/auth/AuthShell';
import { AuthTabs } from '@/component/auth/AuthTabs';
import { ForgotPasswordStep } from '@/component/auth/ForgotPasswordStep';
import { LoginStep } from '@/component/auth/LoginStep';
import { OtpVerifyStep } from '@/component/auth/OtpVerifyStep';
import { VerifyFailedStep, VerifySuccessStep } from '@/component/auth/VerifyResultStep';
import { Button } from '@/component/ui/Button';
import { authApi } from '@/lib/api/auth';
import { HttpError } from '@/lib/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useEnterToSubmit } from '@/lib/hooks/use-enter-to-submit';
import type { LoginPayload, SessionInfo } from '@/types';

type Step = 'login' | 'verifyOtp' | 'success' | 'failed' | 'forgotPassword';

const STEP_INDEX: Record<Step, number> = {
  login: 1,
  verifyOtp: 2,
  success: 3,
  failed: 3,
  forgotPassword: 1,
};

const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_SECONDS = 10;

function LoginWizard(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [credentials, setCredentials] = useState<LoginPayload>({ username: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingToken, setPendingToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | undefined>(undefined);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showForgotHint, setShowForgotHint] = useState(false);

  const [accountLockoutMessage, setAccountLockoutMessage] = useState<string | null>(null);

  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (searchParams.get('reason') === 'unauthorized') {
      toast.error('Halaman itu tidak boleh diakses tanpa masuk terlebih dahulu. Silakan masuk kembali.', {
        duration: 6000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup jalan sekali saat query param pertama kali dibaca
  }, []);

  async function handleCredentialsSubmit(): Promise<void> {
    setFormError(null);
    if (lockoutSeconds > 0 || accountLockoutMessage) {
      return;
    }
    if (!credentials.username || !credentials.password) {
      setFormError('Username dan password wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authApi.login(credentials);
      setFailedAttempts(0);

      if (res.requireOtp) {
        setPendingToken(res.pendingToken ?? '');
        setStep('verifyOtp');
        return;
      }

      setSessionInfo(res.session);
      setStep('success');
    } catch (error) {
      const message = error instanceof HttpError ? error.message : 'Username atau password salah.';

      if (/dikunci|terkunci/i.test(message)) {
        setAccountLockoutMessage(message);
        return;
      }

      setFormError(message);

      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= LOCKOUT_THRESHOLD) {
        setShowForgotHint(true);
        setLockoutSeconds(LOCKOUT_SECONDS);
        setFailedAttempts(0);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(): Promise<void> {
    setIsSubmitting(true);
    setOtpError(null);
    try {
      const res = await authApi.verifyOtp({
        pendingToken,
        otpCode: otp,
      });
      setSessionInfo(res.session);
      setStep('success');
    } catch (error) {
      setOtpError(error instanceof HttpError ? error.message : 'Kode OTP salah, silakan coba lagi.');
      setStep('failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finalizeLogin(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('wms_show_welcome', '1');
    }
    await refreshUser();
    const redirectTarget = searchParams.get('redirect');
    const isSafeRelativePath = redirectTarget?.startsWith('/') && !redirectTarget.startsWith('//');
    router.push(isSafeRelativePath && redirectTarget ? redirectTarget : '/dashboard');
  }

  function handleEnterSubmit(): void {
    if (step === 'login' && lockoutSeconds === 0 && !accountLockoutMessage) {
      void handleCredentialsSubmit();
    } else if (step === 'verifyOtp' && otp.length >= 6) {
      void handleVerifyOtp();
    }
  }
  const handleAuthShellKeyDown = useEnterToSubmit(handleEnterSubmit, { disabled: isSubmitting });

  function renderStep(): React.JSX.Element {
    switch (step) {
      case 'login':
        return (
          <div className="flex flex-col gap-3">
            <AuthTabs active="login" />
            <LoginStep values={credentials} onChange={setCredentials} />
            {formError ? <p className="text-xs text-dangerText">{formError}</p> : null}
            {accountLockoutMessage ? (
              <AccountLockoutBanner
                message={accountLockoutMessage}
                onExpire={() => setAccountLockoutMessage(null)}
              />
            ) : null}
            {lockoutSeconds > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border border-dangerBg bg-dangerBg/40 p-3">
                <p className="text-xs font-semibold text-dangerText">
                  Terlalu banyak percobaan masuk. Harap tunggu {lockoutSeconds} detik sebelum
                  mencoba lagi.
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-dangerBg">
                  <motion.div
                    key={lockoutSeconds}
                    className="h-full rounded-full bg-dangerText"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
              </div>
            ) : null}
            {showForgotHint ? (
              <div className="flex flex-col gap-2 rounded-md border border-warningBg bg-warningBg/60 p-3 text-left">
                <p className="text-xs font-semibold text-warningText">
                  Beberapa kali percobaan masuk gagal.
                </p>
                <p className="text-xs text-textMuted">
                  Kamu lupa password? Silakan reset lewat kode OTP yang dikirim ke WhatsApp atau
                  SMS.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('forgotPassword')}
                  className="self-start text-xs font-semibold text-accent underline"
                >
                  Ke halaman lupa password →
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStep('forgotPassword')}
                className="self-end text-xs text-textMuted underline"
              >
                Lupa password?
              </button>
            )}
          </div>
        );
      case 'forgotPassword':
        return (
          <ForgotPasswordStep
            initialIdentifier={credentials.username}
            onBackToLogin={() => {
              setShowForgotHint(false);
              setStep('login');
            }}
          />
        );
      case 'verifyOtp':
        return (
          <OtpVerifyStep
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleVerifyOtp}
            isSubmitting={isSubmitting}
            errorMessage={otpError}
          />
        );
      case 'success':
        return <VerifySuccessStep session={sessionInfo} onFinish={finalizeLogin} />;
      case 'failed':
        return (
          <VerifyFailedStep
            onRetry={() => {
              setOtp('');
              setStep('verifyOtp');
            }}
            onBack={() => {
              setOtp('');
              setPendingToken('');
              setStep('login');
            }}
          />
        );
      default:
        return <LoginStep values={credentials} onChange={setCredentials} />;
    }
  }

  function loginButtonLabel(): string {
    if (accountLockoutMessage) {
      return 'Akun terkunci sementara';
    }
    if (lockoutSeconds > 0) {
      return `Terlalu banyak percobaan — tunggu ${lockoutSeconds}s`;
    }
    return 'Masuk →';
  }

  function renderFooter(): React.JSX.Element | null {
    if (step === 'login') {
      return (
        <Button
          className="w-full !bg-white !text-accentDark"
          onClick={handleCredentialsSubmit}
          disabled={lockoutSeconds > 0 || Boolean(accountLockoutMessage)}
          loading={isSubmitting && lockoutSeconds === 0 && !accountLockoutMessage}
        >
          {loginButtonLabel()}
        </Button>
      );
    }
    return null;
  }

  return (
    <AuthShell step={STEP_INDEX[step]} totalSteps={3} footer={renderFooter()} onKeyDown={handleAuthShellKeyDown}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <LoginWizard />
    </Suspense>
  );
}
