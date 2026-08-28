'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@iconify/react';
import { captchaApi } from '@/lib/api/security';
import { HttpError } from '@/lib/api/client';

type WidgetStatus = 'idle' | 'verifying' | 'verified' | 'error';

interface TurnstileCheckboxProps {

  readonly token: string;
  readonly onVerified: (token: string) => void;

  readonly onReset?: () => void;
  readonly error?: string | null;
}

export function TurnstileCheckbox({
  token,
  onVerified,
  onReset,
  error,
}: TurnstileCheckboxProps): React.JSX.Element {
  const [status, setStatus] = useState<WidgetStatus>(token ? 'verified' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleToggle(): Promise<void> {
    if (status === 'verifying') {
      return;
    }
    if (status === 'verified') {
      setStatus('idle');
      setErrorMessage(null);
      onReset?.();
      return;
    }

    setStatus('verifying');
    setErrorMessage(null);
    const startedAt = Date.now();
    try {
      const challenge = await captchaApi.generate();

      const elapsed = Date.now() - startedAt;
      const minAnimationMs = 500;
      if (elapsed < minAnimationMs) {
        await new Promise((resolve) => setTimeout(resolve, minAnimationMs - elapsed));
      }
      setStatus('verified');
      onVerified(challenge.captchaToken);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof HttpError ? err.message : 'Gagal memverifikasi, Harap coba lagi.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={status === 'verifying'}
        aria-pressed={status === 'verified'}
        className={clsx(
          'flex w-full items-center gap-3 rounded-md border bg-surface px-4 py-3 text-left transition-colors',
          status === 'error' ? 'border-dangerText' : 'border-borderSoft',
          status !== 'verifying' && 'hover:border-accent',
        )}
      >
        <span
          className={clsx(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors',
            status === 'verified'
              ? 'border-successText bg-successText'
              : 'border-borderSoft bg-white',
          )}
        >
          {status === 'verifying' ? (
            <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin text-textMuted" />
          ) : null}
          {status === 'verified' ? (
            <Icon icon="lucide:check" className="h-4 w-4 text-white" />
          ) : null}
        </span>

        <span className="flex-1">
          <span className="block text-sm font-medium text-text">
            {status === 'verifying' && 'Memverifikasi...'}
            {status === 'verified' && 'Berhasil, kamu terverifikasi'}
            {status === 'error' && 'Verifikasi gagal, coba lagi'}
            {status === 'idle' && 'Verify you are human'}
          </span>
          <span className="block text-xs text-textMuted">silakan memverifikasi bahwa Kamu merupakan manusia</span>
        </span>

        <Icon icon="lucide:shield-check" className="h-5 w-5 shrink-0 text-textMuted" aria-hidden="true" />
      </button>
      {errorMessage ? <p className="text-xs text-dangerText">{errorMessage}</p> : null}
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
    </div>
  );
}
