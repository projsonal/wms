import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, IBM_Plex_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/auth/AuthContext';
import { ConfirmDialogProvider } from '@/component/ui/ConfirmDialog';
import { PreferencesProvider } from '@/component/preferences/PreferencesContext';
import { VersionWatcher } from '@/component/system/VersionWatcher';
import { Toaster } from '@/component/ui/shadcn/sonner';
import './globals.css';

// 3 font yang tersedia lewat Settings -> Tampilan -> Font Aplikasi (lihat
// PreferencesContext.tsx). next/font/google men-download & self-host font
// ini saat build (bukan lewat Google Fonts CDN saat runtime), jadi tidak
// ada request eksternal tambahan / FOUC. Masing-masing diekspos sebagai
// CSS variable, lalu --font-app (dipakai @theme di globals.css) tinggal
// menunjuk ke salah satunya sesuai pilihan user.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

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
    var fontVarMap = { inter: '--font-inter', 'ibm-plex-sans': '--font-ibm-plex-sans', 'plus-jakarta-sans': '--font-plus-jakarta-sans' };
    var font = localStorage.getItem('wms_font');
    if (font && fontVarMap[font]) {
      document.documentElement.style.setProperty('--font-app', 'var(' + fontVarMap[font] + ')');
    }
    var lang = localStorage.getItem('wms_language');
    if (lang) document.documentElement.setAttribute('lang', lang);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- harus sinkron & sebelum paint, lihat komentar di atas */}
        <script dangerouslySetInnerHTML={{ __html: applyStoredPreferencesScript }} />
      </head>
      <body
        className={`${inter.variable} ${ibmPlexSans.variable} ${plusJakartaSans.variable}`}
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
