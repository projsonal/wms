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
  // Kunci modul di matriks perizinan (lihat src/lib/data/permission-modules.ts /
  // pkg/constant di backend). Kalau diisi, link ini juga disaring oleh
  // usePermissions().can(module, 'view') selain oleh `roles` di atas — jadi
  // super admin bisa mematikan modul untuk role admin/karyawan lewat menu
  // Perizinan Hak Akses User, dan menu di sidebar otomatis ikut hilang.
  // Kosongkan kalau link ini belum punya baris permission tersendiri (mis.
  // /settings) sehingga tidak ikut disaring.
  module?: string;
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
      { label: 'Dashboard', href: '/dashboard', roles: ALL_ROLES, module: 'dashboard' },
      { label: 'Ringkasan Stok', href: '/inventory', roles: ALL_ROLES, module: 'kelola_barang' },
    ],
  },
  {
    title: 'Pengelolaan',
    links: [
      { label: 'Barang Masuk', href: '/barang-masuk', roles: ALL_ROLES, module: 'barang_masuk' },
      { label: 'Barang Keluar', href: '/barang-keluar', roles: ALL_ROLES, module: 'barang_keluar' },
      { label: 'Pengajuan Barang', href: '/pengajuan-barang', roles: ALL_ROLES, module: 'pengajuan_barang' },
      { label: 'Barang Rusak', href: '/barang-rusak', roles: ALL_ROLES, module: 'barang_rusak' },
      { label: 'Kelola Barang', href: '/kelola-barang', roles: ALL_ROLES, module: 'kelola_barang' },
      { label: 'Unit Barang (Nomor Seri)', href: '/unit-barang', roles: ALL_ROLES, module: 'kelola_barang' },
    ],
  },
  {
    links: [
      { label: 'Analisa Data', href: '/data-analysis', roles: STAFF_ROLES, module: 'laporan' },
    ],
  },
  {
    title: 'Manajemen',
    links: [
      { label: 'Manajemen User', href: '/user-management', roles: ['super_admin'], module: 'manajemen_user' },
      { label: 'Manajemen Aset Gudang', href: '/aset-gudang', roles: ALL_ROLES, module: 'aset_gudang' },
      { label: 'Tracking Aset', href: '/tracking-aset', roles: ALL_ROLES, module: 'aset_gudang' },

      { label: 'Manajemen Gudang', href: '/warehouse-management', roles: ALL_ROLES, module: 'manajemen_gudang' },
      { label: 'Manajemen Inventaris', href: '/inventory-management', roles: STAFF_ROLES, module: 'stock_opname' },
    ],
  },
  {
    title: 'Laporan',
    links: [
      { label: 'Laporan Inventaris', href: '/reports/inventory', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Barang Masuk', href: '/reports/barang-masuk', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Barang Keluar', href: '/reports/barang-keluar', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Pengajuan Barang', href: '/reports/pengajuan-barang', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Barang Rusak', href: '/reports/barang-rusak', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Tracking Aset', href: '/reports/asset-tracking', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan Stock Opname', href: '/reports/warehouse', roles: STAFF_ROLES, module: 'laporan' },
      { label: 'Laporan FIFO/FEFO', href: '/reports/fifo-fefo', roles: STAFF_ROLES, module: 'laporan' },
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

type ViewPermissionCheck = (module: string, action: 'view') => boolean;

// Menyaring NAV_GROUPS dua lapis: role kasar (seperti getNavGroupsForRole) DAN
// permission modul halus (Lihat) dari matriks Perizinan Hak Akses User. Kalau
// super admin mematikan "Lihat" untuk sebuah modul pada role tertentu, link
// menu itu otomatis hilang dari sidebar untuk user dengan role tersebut.
// Selama data permission masih dimuat (permissionsLoading), link TIDAK
// disembunyikan dulu supaya sidebar tidak "berkedip" kosong sesaat.
export function getVisibleNavGroups(
  role: UserRole,
  can: ViewPermissionCheck,
  permissionsLoading: boolean,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (!canAccess(role, link.roles)) {
        return false;
      }
      if (!link.module || permissionsLoading) {
        return true;
      }
      return can(link.module, 'view');
    }),
  })).filter((group) => group.links.length > 0);
}

// Dipakai RoleGuard untuk tahu modul apa yang menaungi sebuah path, supaya
// akses langsung lewat URL (bukan cuma klik di sidebar) juga ikut diblokir
// kalau "Lihat" untuk modul itu dimatikan. Mengembalikan undefined kalau path
// tidak terdaftar di NAV_GROUPS (mis. /settings, /login) — path seperti itu
// tidak ikut disaring oleh permission modul.
export function getModuleForPath(pathname: string): string | undefined {
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      if (pathname === link.href || pathname.startsWith(`${link.href}/`)) {
        return link.module;
      }
    }
  }
  return undefined;
}
