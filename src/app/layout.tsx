import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/AuthContext';
import { ConfirmDialogProvider } from '@/component/ui/ConfirmDialog';
import { PreferencesProvider } from '@/component/preferences/PreferencesContext';
import { VersionWatcher } from '@/component/system/VersionWatcher';
import { Toaster } from '@/component/ui/shadcn/sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'WMS-RSD',
  description: 'Warehouse Management System - kelola gudang, stok, dan pengiriman.',
  icons: {
    icon: '/assets/icon_wms.ico',
    shortcut: '/assets/icon_wms.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const applyStoredPreferencesScript = `
(function () {
  try {
    var theme = localStorage.getItem('wms_theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    var lang = localStorage.getItem('wms_language');
    if (lang) document.documentElement.setAttribute('lang', lang);
  } catch (e) {}
})();
`;

const suppressExtensionHydrationNoiseScript = `
(function () {
  var patterns = ['bis_skin_checked', 'bis_register', '__processed_', 'cz-shortcut-listen', 'data-new-gr-c-s-check-loaded', 'data-gr-ext-installed', 'data-lt-installed', 'grammarly', 'colorzilla'];
  var originalError = console.error;
  console.error = function () {
    var text = '';
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === 'string') text += arguments[i] + ' ';
    }
    if (/hydrat/i.test(text)) {
      for (var j = 0; j < patterns.length; j++) {
        if (text.indexOf(patterns[j]) !== -1) return;
      }
    }
    originalError.apply(console, arguments);
  };
})();
`;

export default function RootLayout({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: suppressExtensionHydrationNoiseScript }} />
        <script dangerouslySetInnerHTML={{ __html: applyStoredPreferencesScript }} />
      </head>
      <body
        className={inter.variable}
        suppressHydrationWarning
      >
        <PreferencesProvider>
          <AuthProvider>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
          </AuthProvider>
        </PreferencesProvider>
        <VersionWatcher />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
