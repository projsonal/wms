'use client';

import { useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;

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

      target.type !== 'checkbox'
    ) {
      event.preventDefault();
      onEnterSubmit();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >

      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-borderSoft px-6 py-4">
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
        <div
          className="flex flex-col gap-4 overflow-y-auto px-6 py-4"
          onKeyDown={handleContentKeyDown}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-borderSoft px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
