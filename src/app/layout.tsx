import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/AuthContext';
import { ConfirmDialogProvider } from '@/component/ui/ConfirmDialog';
import { PreferencesProvider } from '@/component/preferences/PreferencesContext';
import { VersionWatcher } from '@/component/system/VersionWatcher';
import { Toaster } from '@/component/ui/shadcn/sonner';
import './globals.css';

// Font aplikasi TIDAK lagi bisa dipilih user (opsi "Font Aplikasi" di
// Settings > Tampilan sudah dihapus) — Inter dipakai tetap di seluruh
// halaman. next/font/google men-download & self-host font ini saat build
// (bukan lewat Google Fonts CDN saat runtime), jadi tidak ada request
// eksternal tambahan / FOUC.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'WMS-RSD',
  description: 'Warehouse Management System - kelola gudang, stok, dan pengiriman.',
  icons: {
    icon: '/assets/icon_wms.ico',
    shortcut: '/assets/icon_wms.ico',
  },
};

// PENTING: tanpa export ini, Next.js TIDAK memasang <meta name="viewport">
// sama sekali. Browser di HP asli lalu menganggap halaman didesain untuk
// layar desktop (~980px), me-render di lebar itu, lalu men-scale-down
// paksa supaya muat — bukan benar-benar layout mobile. Itu sebabnya semua
// breakpoint Tailwind (sm:/md:/lg:) dan lebar elemen terlihat "berantakan"
// hanya di HP sungguhan, padahal mode responsive DevTools di laptop selalu
// terlihat normal (DevTools selalu mengasumsikan viewport meta yang benar).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Dijalankan SEBELUM React hydrate, langsung di <head>, supaya tema
// gelap/font pilihan user diterapkan sejak render pertama — tanpa ini akan
// selalu "kedip" terang sesaat sebelum PreferencesProvider sempat jalan
// (FOUC / flash-of-wrong-theme).
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
        {/* Container global untuk semua toast.success/error/dst dari sonner
            (dipakai di hampir semua halaman) — tanpa ini toast dipanggil tapi
            tidak pernah benar-benar tampil di layar. */}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
