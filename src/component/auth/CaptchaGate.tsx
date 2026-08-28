'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CaptchaField } from '@/component/auth/CaptchaField';
import { Button } from '@/component/ui/Button';
import { BotCheckRequiredError } from '@/lib/api/client';
import { checkBackendHealth } from '@/lib/api/health';
import { securityApi } from '@/lib/api/security';
import type { CaptchaChallenge } from '@/types';

type GateStatus = 'checking' | 'challenge' | 'ready';

interface BotGateContextValue {
  requireRecheck: () => void;
}

const BotGateContext = createContext<BotGateContextValue | undefined>(undefined);

export function useBotGate(): BotGateContextValue {
  const ctx = useContext(BotGateContext);
  if (!ctx) {
    throw new Error('useBotGate harus dipakai di dalam <CaptchaGate>');
  }
  return ctx;
}

function LoadingDots(): React.JSX.Element {
  return (
    <span className="flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

export function useRunWithBotGate() {
  const { requireRecheck } = useBotGate();
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (error instanceof BotCheckRequiredError) {
          requireRecheck();
        }
        throw error;
      }
    },
    [requireRecheck],
  );
}

interface CaptchaGateProps {
  children: ReactNode;
}

export function CaptchaGate({ children }: Readonly<CaptchaGateProps>): React.JSX.Element {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runCheck = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      const res = await securityApi.verify();
      if (res.passed) {
        setStatus('ready');
      } else {
        setChallenge(res.captcha ?? null);
        setStatus('challenge');
      }
    } catch {
      const health = await checkBackendHealth();
      setError(health.message);
      setStatus('challenge');
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  async function handleSolve(): Promise<void> {
    if (!challenge) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await securityApi.solve({ captchaToken: challenge.captchaToken, captchaAnswer: answer });
      if (res.passed) {
        setStatus('ready');
      } else {
        setError('Jawaban captcha salah, coba lagi.');
        setChallenge(res.captcha ?? challenge);
        setAnswer('');
      }
    } catch {
      setError('Jawaban captcha salah atau kedaluwarsa, silakan coba lagi. klik button refresh captcha di ataas sebelah kanan');
      setAnswer('');
    } finally {
      setIsSubmitting(false);
    }
  }

  const contextValue = useMemo<BotGateContextValue>(() => ({
    requireRecheck: () => runCheck(),
  }), [runCheck]);

 if (status === 'checking') {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-sm text-textMuted">
      <div className="flex items-center gap-1">
        <span>Memeriksa keamanan sesi</span>
       <LoadingDots></LoadingDots>
      </div>
    </div>
  );
}

  if (status === 'challenge') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm rounded-lg border border-borderSoft bg-surface p-6 shadow-card">
          <h1 className="text-base font-semibold text-text">Verifikasi Keamanan</h1>
          <p className="mt-1 text-xs text-textMuted">
            Selesaikan captcha terlebih dahulu, sebelum melanjutkan ke halaman login.
          </p>
          {challenge ? (
            <div className="mt-4">
              <CaptchaField
                challenge={challenge}
                answer={answer}
                onAnswerChange={setAnswer}
                onRefresh={runCheck}
              />
            </div>
          ) : null}
          {error ? <p className="mt-3 text-xs text-dangerText">{error}</p> : null}
          {challenge ? (
            <Button className="mt-4 w-full" onClick={handleSolve} disabled={isSubmitting || !answer}>
              Verifikasi
            </Button>
          ) : (
            <Button className="mt-4 w-full" onClick={runCheck}>
              Coba Lagi
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <BotGateContext.Provider value={contextValue}>{children}</BotGateContext.Provider>;
}
