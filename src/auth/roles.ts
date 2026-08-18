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
const STAFF_ROLES: UserRole[] = ['super_admin', 'admin'];

/**
 * Struktur menu sidebar mengikuti desain asli WMS-RSD.
 * "Manajemen User" dan "Manajemen Aset Gudang" dibatasi untuk Super Admin & Admin
 * — Karyawan tidak diberi akses administratif ke user maupun manajemen aset lintas gudang.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    links: [
      { label: 'Dashboard', href: '/home/dashboard', roles: ALL_ROLES },
      { label: 'Pickup & Dropoff', href: '/home/pickup-dropoff', roles: ALL_ROLES },
      { label: 'Purchase Order', href: '/home/purchase-order', roles: STAFF_ROLES },
      { label: 'WMS', href: '/home/warehouse', roles: ALL_ROLES },
      { label: 'Supplier', href: '/home/supplier', roles: STAFF_ROLES },
      { label: 'Inventaris', href: '/home/inventory', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Pengelolaan',
    links: [
      { label: 'Barang Masuk', href: '/home/barang-masuk', roles: ALL_ROLES },
      { label: 'Barang Keluar', href: '/home/barang-keluar', roles: ALL_ROLES },
      { label: 'Barang Rusak', href: '/home/barang-rusak', roles: ALL_ROLES },
      { label: 'Kelola Barang', href: '/home/kelola-barang', roles: ALL_ROLES },
    ],
  },
  {
    links: [
      { label: 'COD Monitoring', href: '/home/cod-monitoring', roles: ALL_ROLES },
      { label: 'Monitoring Pengiriman', href: '/home/delivery-monitoring', roles: ALL_ROLES },
      { label: 'Analisa Data', href: '/home/data-analysis', roles: STAFF_ROLES },
    ],
  },
  {
    title: 'Manajemen',
    links: [
      { label: 'Manajemen User', href: '/home/user-management', roles: ['super_admin'] },
      { label: 'Manajemen Aset Gudang', href: '/home/aset-gudang', roles: ALL_ROLES },
      { label: 'Tracking Aset', href: '/home/tracking-aset', roles: ALL_ROLES },
      { label: 'Manajemen Gudang', href: '/home/warehouse-management', roles: STAFF_ROLES },
      { label: 'Manajemen Inventaris', href: '/home/inventory-management', roles: STAFF_ROLES },
    ],
  },
  {
    title: 'Laporan',
    links: [
      { label: 'Laporan Inventaris', href: '/home/reports/inventory', roles: STAFF_ROLES },
      { label: 'Laporan Barang Masuk', href: '/home/reports/barang-masuk', roles: STAFF_ROLES },
      { label: 'Laporan Barang Keluar', href: '/home/reports/barang-keluar', roles: STAFF_ROLES },
      { label: 'Laporan Barang Retur', href: '/home/reports/returns', roles: STAFF_ROLES },
      { label: 'Laporan Stock Opname', href: '/home/reports/warehouse', roles: STAFF_ROLES },
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
