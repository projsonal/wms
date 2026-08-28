'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@iconify/react';
import { humanCheckApi } from '@/lib/api/security';

const VERIFY_DELAY_MS = 2500;

interface HumanCheckFieldProps {

  readonly onVerified: (token: string) => void;

  readonly onReset?: () => void;

  readonly resetKey?: string | number;
}

type Status = 'loading' | 'waiting' | 'verified' | 'error';

export function HumanCheckField({
  onVerified,
  onReset,
  resetKey,
}: HumanCheckFieldProps): React.JSX.Element {
  const [status, setStatus] = useState<Status>('loading');
  const tokenRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function issue(): Promise<void> {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    tokenRef.current = null;
    setStatus('loading');
    onReset?.();
    try {
      const res = await humanCheckApi.issue();
      tokenRef.current = res.humanCheckToken;
      setStatus('waiting');
      timeoutRef.current = setTimeout(() => {
        if (tokenRef.current) {
          setStatus('verified');
          onVerified(tokenRef.current);
        }
      }, VERIFY_DELAY_MS);
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    issue();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- issue ulang saat resetKey berubah
  }, [resetKey]);

  return (
    <div className="flex items-center gap-3 rounded-md border border-borderSoft bg-surface px-4 py-3">
      <span
        className={clsx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2',
          status === 'verified' ? 'border-successText bg-successBg text-successText' : 'border-borderSoft text-transparent',
        )}
        aria-hidden="true"
      >
        {status === 'waiting' || status === 'loading' ? (
          <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin text-textMuted" />
        ) : (
          <Icon icon="lucide:check" className="h-4 w-4" />
        )}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">Verifikasi kamu bukan robot</p>
        <p className="text-xs text-textMuted">
          {status === 'loading' ? 'Menyiapkan verifikasi...' : null}
          {status === 'waiting' ? 'Memverifikasi, mohon tunggu sebentar...' : null}
          {status === 'verified' ? 'Terverifikasi' : null}
          {status === 'error' ? 'Gagal memuat verifikasi.' : null}
        </p>
      </div>
      {status === 'error' ? (
        <button type="button" onClick={issue} className="text-xs font-semibold text-accentDark underline">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
