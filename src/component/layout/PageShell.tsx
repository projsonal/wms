import type { ReactNode } from 'react';
import { Header } from '@/component/layout/Header';
import { Footer } from '@/component/layout/Footer';

interface PageShellProps {
  title: string;
  breadcrumb: string;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Bingkai standar setiap halaman dashboard: Header (judul + breadcrumb),
 * area konten utama, lalu Footer. Dipakai oleh semua komponen konten di
 * `component/gudang`, `component/pengiriman`, `component/laporan`, dan
 * `component/content`, supaya halaman page.tsx tetap tipis.
 */
export function PageShell({ title, breadcrumb, action, children }: PageShellProps): React.JSX.Element {
  return (
    <>
      <Header title={title} breadcrumb={breadcrumb} action={action} />
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:gap-6">{children}</div>
      </main>
      <Footer />
    </>
  );
}
