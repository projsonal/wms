'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export function ErrorLogger(): null {
  useEffect(() => {
    function handleError(event: ErrorEvent): void {
      logger.error(event.message || 'Unhandled window error', {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        url: window.location.href,
      });
    }

    function handleRejection(event: PromiseRejectionEvent): void {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      logger.error(message || 'Unhandled promise rejection', {
        stack: reason instanceof Error ? reason.stack : undefined,
        url: window.location.href,
      });
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
