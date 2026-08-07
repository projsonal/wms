'use client';

import { useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Dipanggil saat pengguna menekan Enter di dalam salah satu input teks
   * modal ini (bukan textarea, supaya baris baru di textarea tidak ikut
   * men-submit). Biasanya diisi handler simpan yang sama seperti tombol
   * utama di `footer`, supaya isi form bisa dikirim tanpa menyentuh mouse. */
  onEnterSubmit?: () => void;
}

const ENTER_SUBMIT_TAGS = new Set(['INPUT', 'SELECT']);

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  onEnterSubmit,
}: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLInputElement;
    if (
      event.key === 'Enter' &&
      onEnterSubmit &&
      ENTER_SUBMIT_TAGS.has(target.tagName) &&
      // Input type="text/number/email/..." — bukan checkbox yang Enter-nya
      // punya arti lain (mis. toggle).
      target.type !== 'checkbox'
    ) {
      event.preventDefault();
      onEnterSubmit();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full text-textMuted hover:bg-surfaceAlt"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4" onKeyDown={handleContentKeyDown}>
          {children}
        </div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
