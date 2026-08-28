'use client';

import { useEffect } from 'react';
import { StatusScreen } from '@/component/system/StatusScreen';
import { logger } from '@/lib/logger';

export default function GlobalErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>): React.JSX.Element {
  useEffect(() => {
    logger.error(error.message || 'Runtime error tertangkap error.tsx', {
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [error]);

  return (
    <StatusScreen
      code="500"
      actions={[
        { label: 'Coba Lagi', onClick: reset, variant: 'primary' },
        { label: 'Kembali ke Dashboard', href: '/dashboard', variant: 'secondary' },
      ]}
    />
  );
}
