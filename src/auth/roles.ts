import type { UserRole } from '@/types';

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  karyawan: 'Karyawan',
};

export const ROLE_OPTIONS: { role: UserRole; description: string }[] = [
  { role: 'super_admin', description: 'Akses penuh ke seluruh modul termasuk manajemen user' },
  { role: 'admin', description: 'Mengelola operasional gudang, stok, dan laporan' },
  { role: 'karyawan', description: 'Menjalankan tugas operasional harian gudang' },
];

export interface NavLink {
  label: string;
  href: string;
  roles: UserRole[];
}

export interface NavGroup {
  title?: string;
  links: NavLink[];
}

const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'karyawan'];
export const STAFF_ROLES: UserRole[] = ['super_admin', 'admin'];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    links: [
      { label: 'Dashboard', href: '/dashboard', roles: ALL_ROLES },
      { label: 'Ringkasan Stok', href: '/inventory', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Pengelolaan',
    links: [
      { label: 'Barang Masuk', href: '/barang-masuk', roles: ALL_ROLES },
      { label: 'Barang Keluar', href: '/barang-keluar', roles: ALL_ROLES },
      { label: 'Barang Rusak', href: '/barang-rusak', roles: ALL_ROLES },
      { label: 'Kelola Barang', href: '/kelola-barang', roles: ALL_ROLES },
      { label: 'Unit Barang (Nomor Seri)', href: '/unit-barang', roles: ALL_ROLES },
    ],
  },
  {
    links: [
      { label: 'Analisa Data', href: '/data-analysis', roles: STAFF_ROLES },
    ],
  },
  {
    title: 'Manajemen',
    links: [
      { label: 'Manajemen User', href: '/user-management', roles: ['super_admin'] },
      { label: 'Manajemen Aset Gudang', href: '/aset-gudang', roles: ALL_ROLES },
      { label: 'Tracking Aset', href: '/tracking-aset', roles: ALL_ROLES },

      { label: 'Manajemen Gudang', href: '/warehouse-management', roles: ALL_ROLES },
      { label: 'Manajemen Inventaris', href: '/inventory-management', roles: STAFF_ROLES },
    ],
  },
  {
    title: 'Laporan',
    links: [
      { label: 'Laporan Inventaris', href: '/reports/inventory', roles: STAFF_ROLES },
      { label: 'Laporan Barang Masuk', href: '/reports/barang-masuk', roles: STAFF_ROLES },
      { label: 'Laporan Barang Keluar', href: '/reports/barang-keluar', roles: STAFF_ROLES },
      { label: 'Laporan Barang Rusak', href: '/reports/barang-rusak', roles: STAFF_ROLES },
      { label: 'Laporan Barang Retur', href: '/reports/returns', roles: STAFF_ROLES },
      { label: 'Laporan Stock Opname', href: '/reports/warehouse', roles: STAFF_ROLES },
    ],
  },
];

export function canAccess(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => canAccess(role, link.roles)),
  })).filter((group) => group.links.length > 0);
}
