'use client';

import { useEffect } from 'react';
import { StatusScreen } from '@/component/system/StatusScreen';

export default function GlobalErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>): React.JSX.Element {
  useEffect(() => {
    console.error('Runtime error tertangkap error.tsx:', error);
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
