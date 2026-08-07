import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'StokRSD WMS',
  description: 'Warehouse Management System - kelola gudang, stok, dan pengiriman.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
