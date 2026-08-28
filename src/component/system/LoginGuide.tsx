import { toast } from 'sonner';
import type { UserRole } from '@/types';

const PREF_KEY = 'wms_login_guide_enabled';

export function isLoginGuideEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setLoginGuideEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
}

const GUIDE_MESSAGE: Record<UserRole, string> = {
  super_admin:
    'Kelola akses & izin lewat Manajemen User, atau pantau seluruh modul dari Dashboard.',
  admin:
    'Catat barang masuk/keluar lewat menu Pengelolaan, cek stok menipis di Ringkasan Stok.',
  karyawan:
    'Menu utamamu ada di Pengelolaan (Barang Masuk/Keluar) semuanya di sidebar kiri.',
};

export function showLoginGuide(role: UserRole): void {
  if (!isLoginGuideEnabled()) return;
  toast.info(GUIDE_MESSAGE[role], { duration: 8000 });
}
