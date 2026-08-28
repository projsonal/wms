'use client';

import { usePreferences } from '@/component/preferences/PreferencesContext';

const DICT = {
  id: {
    'sidebar.dashboard': 'Dashboard',
    'sidebar.analisaData': 'Analisa Data',
    'sidebar.manajemen': 'MANAJEMEN',
    'sidebar.manajemenUser': 'Manajemen User',
    'sidebar.manajemenAsetGudang': 'Manajemen Aset Gudang',
    'sidebar.barangRusak': 'Barang Rusak',
    'sidebar.manajemenGudang': 'Manajemen Gudang',
    'sidebar.manajemenInventaris': 'Manajemen Inventaris',
    'sidebar.laporan': 'LAPORAN',
    'sidebar.laporanInventaris': 'Laporan Inventaris',
    'sidebar.laporanBarangMasuk': 'Laporan Barang Masuk',
    'sidebar.laporanBarangKeluar': 'Laporan Barang Keluar',
    'sidebar.laporanBarangRetur': 'Laporan Barang Retur',
    'sidebar.laporanStockOpname': 'Laporan Stock Opname',
    'sidebar.settings': 'Settings',
    'sidebar.logout': 'Logout',
    'settings.title': 'Settings',
    'settings.tabs.profil': 'Profil',
    'settings.tabs.notifikasi': 'Notifikasi',
    'settings.tabs.keamanan': 'Keamanan',
    'settings.tabs.tampilan': 'Tampilan',
    'settings.tabs.sistem': 'Sistem',
    'settings.appearance.title': 'Tampilan',
    'settings.appearance.darkMode.title': 'Mode Gelap',
    'settings.appearance.darkMode.description': 'Gunakan tema gelap (coklat tua) pada seluruh halaman',
    'settings.appearance.compactSidebar.title': 'Sidebar Ringkas',
    'settings.appearance.compactSidebar.description': 'Ciutkan label menu, tampilkan ikon saja',
    'settings.appearance.language.title': 'Bahasa',
    'settings.appearance.language.description': 'Bahasa antarmuka aplikasi (Indonesia / English)',
  },
  en: {
    'sidebar.dashboard': 'Dashboard',
    'sidebar.analisaData': 'Data Analysis',
    'sidebar.manajemen': 'MANAGEMENT',
    'sidebar.manajemenUser': 'User Management',
    'sidebar.manajemenAsetGudang': 'Warehouse Asset Management',
    'sidebar.barangRusak': 'Damaged Goods',
    'sidebar.manajemenGudang': 'Warehouse Management',
    'sidebar.manajemenInventaris': 'Inventory Management',
    'sidebar.laporan': 'REPORTS',
    'sidebar.laporanInventaris': 'Inventory Report',
    'sidebar.laporanBarangMasuk': 'Incoming Goods Report',
    'sidebar.laporanBarangKeluar': 'Outgoing Goods Report',
    'sidebar.laporanBarangRetur': 'Returned Goods Report',
    'sidebar.laporanStockOpname': 'Stock Opname Report',
    'sidebar.settings': 'Settings',
    'sidebar.logout': 'Logout',
    'settings.title': 'Settings',
    'settings.tabs.profil': 'Profile',
    'settings.tabs.notifikasi': 'Notifications',
    'settings.tabs.keamanan': 'Security',
    'settings.tabs.tampilan': 'Appearance',
    'settings.tabs.sistem': 'System',
    'settings.appearance.title': 'Appearance',
    'settings.appearance.darkMode.title': 'Dark Mode',
    'settings.appearance.darkMode.description': 'Use the dark (deep brown) theme across the whole app',
    'settings.appearance.compactSidebar.title': 'Compact Sidebar',
    'settings.appearance.compactSidebar.description': 'Collapse menu labels, show icons only',
    'settings.appearance.language.title': 'Language',
    'settings.appearance.language.description': 'App interface language (Indonesian / English)',
  },
} as const;

export type TranslationKey = keyof typeof DICT.id;

export function useTranslations(): (key: TranslationKey) => string {
  const { language } = usePreferences();
  return (key: TranslationKey) => DICT[language]?.[key] ?? DICT.id[key] ?? key;
}
