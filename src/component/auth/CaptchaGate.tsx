'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CaptchaField } from '@/component/auth/CaptchaField';
import { Button } from '@/component/ui/Button';
import { BotCheckRequiredError } from '@/lib/api/client';
import { checkBackendHealth } from '@/lib/api/health';
import { securityApi } from '@/lib/api/security';
import type { CaptchaChallenge } from '@/types';

type GateStatus = 'checking' | 'challenge' | 'ready';

interface BotGateContextValue {
  /** Dipanggil dari mana pun saat sebuah request gagal karena bot-token
   * kedaluwarsa (`BotCheckRequiredError`), supaya gerbang captcha muncul
   * lagi tanpa perlu me-refresh seluruh halaman. */
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

/** Helper supaya pemanggil tidak perlu try/catch manual di tiap tempat —
 * cukup bungkus pemanggilan API dengan ini di dalam <CaptchaGate>. */
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

/**
 * Backend gostock memasang middleware anti-bot di depan hampir seluruh
 * endpoint (termasuk /auth/*) yang mewajibkan header `X-Bot-Token` valid.
 * Komponen ini memastikan token itu ada SEBELUM form login/register
 * ditampilkan: cek diam-diam ke /security/verify, dan kalau belum lolos
 * tampilkan captcha singkat dulu.
 */
export function CaptchaGate({ children }: CaptchaGateProps): React.JSX.Element {
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
      // Diagnosa lebih detail daripada "gagal" generik: cek dulu apakah
      // backend-nya sama sekali tidak terjangkau (server mati/salah port/
      // CORS) supaya pengguna tahu harus benerin apa.
      const health = await checkBackendHealth();
      setError(health.message);
      setStatus('challenge');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runCheck async, lihat AuthContext untuk pola yang sama
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
      setError('Jawaban captcha salah atau kedaluwarsa, coba lagi.');
      setAnswer('');
    } finally {
      setIsSubmitting(false);
    }
  }

  const contextValue: BotGateContextValue = {
    requireRecheck: () => runCheck(),
  };

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-textMuted">
        Memeriksa keamanan sesi...
      </div>
    );
  }

  if (status === 'challenge') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm rounded-lg border border-borderSoft bg-surface p-6 shadow-card">
          <h1 className="text-base font-semibold text-text">Verifikasi Keamanan</h1>
          <p className="mt-1 text-xs text-textMuted">
            Selesaikan captcha berikut untuk melanjutkan ke halaman login.
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
