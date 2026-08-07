'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountLockoutBanner } from '@/component/auth/AccountLockoutBanner';
import { AuthShell } from '@/component/auth/AuthShell';
import { CaptchaGate, useRunWithBotGate } from '@/component/auth/CaptchaGate';
import { ForgotPasswordStep } from '@/component/auth/ForgotPasswordStep';
import { LoginStep } from '@/component/auth/LoginStep';
import { TwoFactorSetupStep } from '@/component/auth/TwoFactorSetupStep';
import { OtpVerifyStep } from '@/component/auth/OtpVerifyStep';
import { VerifyFailedStep, VerifySuccessStep } from '@/component/auth/VerifyResultStep';
import { Button } from '@/component/ui/Button';
import { authApi } from '@/lib/api/auth';
import { BotCheckRequiredError, HttpError } from '@/lib/api/client';
import { buildDemoUser, DEMO_MODE_ENABLED, setDemoUser } from '@/auth/demo';
import { useAuth } from '@/auth/AuthContext';
import type { LoginPayload, OtpMethod, SessionInfo } from '@/types';

type Step = 'login' | 'setup2fa' | 'verifyOtp' | 'success' | 'failed' | 'forgotPassword';

const STEP_INDEX: Record<Step, number> = {
  login: 1,
  setup2fa: 2,
  verifyOtp: 2,
  success: 3,
  failed: 3,
  forgotPassword: 1,
};

/** Setelah gagal login 3x berturut-turut: kunci tombol masuk selama 10 detik
 * (anti-spam) dan tampilkan ajakan "lupa password" sebagai alternatif. */
const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_SECONDS = 10;

function LoginWizard(): React.JSX.Element {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const runWithBotGate = useRunWithBotGate();

  const [step, setStep] = useState<Step>('login');
  const [previousStep, setPreviousStep] = useState<'setup2fa' | 'verifyOtp'>('verifyOtp');
  const [credentials, setCredentials] = useState<LoginPayload>({ username: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingToken, setPendingToken] = useState('');
  const [otp, setOtp] = useState('');

  // Setup 2FA (pengguna baru, belum pernah aktifkan 2FA).
  const [totpSecret, setTotpSecret] = useState('');

  // Verifikasi OTP (pengguna lama, 2FA sudah aktif).
  const [otpMethod, setOtpMethod] = useState<OtpMethod>('totp');
  const [otpToken, setOtpToken] = useState('');
  const [isRequestingWhatsapp, setIsRequestingWhatsapp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | undefined>(undefined);

  // Anti-spam login: hitung kegagalan berturut-turut, kunci tombol sementara,
  // dan tawarkan alternatif lupa password kalau kredensialnya memang salah.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showForgotHint, setShowForgotHint] = useState(false);

  // Lockout akun dari SERVER (mis. "akun anda dikunci sementara ... coba
  // lagi dalam 5 menit") — beda dari lockoutSeconds di atas yang cuma
  // anti-spam sisi klien; ini otoritatif dari backend, bisa lebih lama.
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
      const res = await runWithBotGate(() => authApi.login(credentials));
      setPendingToken(res.pendingToken ?? '');
      setFailedAttempts(0);

      if (res.requireSetup2fa) {
        const setup = await runWithBotGate(() => authApi.setupTwoFactor(res.pendingToken ?? ''));
        setTotpSecret(setup.secret);
        setPreviousStep('setup2fa');
        setStep('setup2fa');
        return;
      }
      if (res.requireOtp) {
        setOtpMethod('totp');
        setPreviousStep('verifyOtp');
        setStep('verifyOtp');
        return;
      }
      setFormError('Respons server tidak dikenali, silakan coba lagi.');
    } catch (error) {
      if (error instanceof BotCheckRequiredError) {
        // CaptchaGate akan menampilkan tantangan captcha-nya sendiri —
        // bukan kegagalan kredensial, jadi tidak dihitung sebagai percobaan gagal.
        return;
      }

      const message = error instanceof HttpError ? error.message : 'Username atau password salah.';

      // Backend gostock membalas dengan pesan lockout akun (bukan cuma
      // captcha) saat rate-limit sisi server terlampaui — tangkap polanya
      // di sini supaya ditampilkan sebagai hitung mundur, bukan teks datar.
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

  async function handleVerifyOtp(): Promise<void> {
    setIsSubmitting(true);
    setOtpError(null);
    try {
      const res = await runWithBotGate(() =>
        authApi.verifyOtp({
          pendingToken,
          otpCode: otp,
          method: otpMethod,
          otpToken: otpMethod === 'whatsapp' ? otpToken : undefined,
        }),
      );
      setSessionInfo(res.session);
      setStep('success');
    } catch {
      setStep('failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestWhatsapp(): Promise<void> {
    setIsRequestingWhatsapp(true);
    setOtpError(null);
    try {
      const res = await runWithBotGate(() => authApi.requestOtp(pendingToken, 'whatsapp'));
      setOtpToken(res.otpToken);
      setOtpMethod('whatsapp');
      setOtp('');
    } catch (error) {
      setOtpError(
        error instanceof HttpError
          ? error.message
          : 'Gagal mengirim kode WhatsApp, coba lagi.',
      );
    } finally {
      setIsRequestingWhatsapp(false);
    }
  }

  async function finalizeLogin(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('wms_show_welcome', '1');
    }
    await refreshUser();
    router.push('/dashboard');
  }

  function enterPreviewMode(): void {
    setDemoUser(buildDemoUser('super_admin'));
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('wms_show_welcome', '1');
    }
    router.push('/dashboard');
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

  function renderStep(): React.JSX.Element {
    switch (step) {
      case 'login':
        return (
          <div className="flex flex-col gap-3">
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
      case 'setup2fa':
        return (
          <TwoFactorSetupStep
            secret={totpSecret}
            accountLabel={credentials.username}
            otp={otp}
            onOtpChange={setOtp}
            onCancel={() => setStep('login')}
            onActivate={handleConfirmSetup2FA}
            isSubmitting={isSubmitting}
            onExpire={refreshTwoFactorSetup}
          />
        );
      case 'verifyOtp':
        return (
          <OtpVerifyStep
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleVerifyOtp}
            isSubmitting={isSubmitting}
            method={otpMethod}
            isRequestingWhatsapp={isRequestingWhatsapp}
            onRequestWhatsapp={handleRequestWhatsapp}
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
              setStep(previousStep);
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
        <>
          <p className="mb-3 text-center text-xs text-white/80">Belum punya akun?</p>
          <Link href="/register">
            <Button variant="secondary" className="mb-3 w-full !border-white/40 !bg-transparent !text-white">
              Daftar Akun Baru
            </Button>
          </Link>
          <Button
            className="w-full !bg-white !text-accentDark"
            onClick={handleCredentialsSubmit}
            disabled={isSubmitting || lockoutSeconds > 0 || Boolean(accountLockoutMessage)}
          >
            {loginButtonLabel()}
          </Button>
        </>
      );
    }
    return null;
  }

  return (
    <AuthShell step={STEP_INDEX[step]} totalSteps={3} footer={renderFooter()}>
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
      {step === 'login' && DEMO_MODE_ENABLED ? (
        <motion.button
          type="button"
          onClick={enterPreviewMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          className="mt-4 w-full text-center text-xs text-textMuted underline"
        >
          Backend belum terhubung? Lanjutkan dalam mode pratinjau
        </motion.button>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <CaptchaGate>
      <LoginWizard />
    </CaptchaGate>
  );
}
