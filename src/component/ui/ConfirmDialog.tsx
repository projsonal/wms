'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react';
import { Button } from '@/component/ui/Button';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;

  variant?: 'danger' | 'protect' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const VARIANT_META = {
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-dangerText',
    iconBg: 'bg-dangerBg',
    confirmClass: 'bg-dangerText hover:bg-dangerText/90',
  },
  protect: {
    icon: ShieldAlert,
    iconClass: 'text-warningText',
    iconBg: 'bg-warningBg',
    confirmClass: 'bg-warningText hover:bg-warningText/90',
  },
  default: {
    icon: HelpCircle,
    iconClass: 'text-accentDark',
    iconBg: 'bg-accentSoft',
    confirmClass: 'bg-accentDark hover:bg-accent',
  },
} as const;

export function ConfirmDialogProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<ConfirmState | null>(null);
  const pendingRef = useRef<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const next: ConfirmState = { ...options, resolve };
      pendingRef.current = next;
      setState(next);
    });
  }, []);

  function settle(result: boolean): void {
    pendingRef.current?.resolve(result);
    pendingRef.current = null;
    setState(null);
  }

  const meta = VARIANT_META[state?.variant ?? 'default'];
  const Icon = meta.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={state.title}
        >
          <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-card">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${meta.iconBg}`}>
                <Icon className={`h-6 w-6 ${meta.iconClass}`} />
              </div>
              <h2 className="text-base font-semibold text-text">{state.title}</h2>
              <p className="text-sm text-textMuted">{state.message}</p>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => settle(false)}>
                {state.cancelLabel ?? 'Tidak'}
              </Button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors ${meta.confirmClass}`}
              >
                {state.confirmLabel ?? 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm harus dipakai di dalam <ConfirmDialogProvider> (lihat app/layout.tsx)');
  }
  return ctx.confirm;
}
