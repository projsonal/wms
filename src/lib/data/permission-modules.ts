export interface PermissionModuleDef {

  key: string;

  module: string;
  label: string;
}

export type PermissionTabKey = 'umum' | 'approval' | 'laporan' | 'sistem';

export const PERMISSION_TABS: { key: PermissionTabKey; label: string }[] = [
  { key: 'umum', label: 'Umum' },
  { key: 'approval', label: 'Approval' },
  { key: 'laporan', label: 'Laporan' },
  { key: 'sistem', label: 'Sistem' },
];

export const PERMISSION_MODULES: Record<PermissionTabKey, PermissionModuleDef[]> = {
  umum: [
    { key: 'dashboard', module: 'dashboard', label: 'Dashboard' },

    { key: 'inventaris', module: 'stock_opname', label: 'Inventaris' },
    { key: 'barang-masuk', module: 'barang_masuk', label: 'Barang Masuk' },
    { key: 'barang-keluar', module: 'barang_keluar', label: 'Barang Keluar' },
    { key: 'kelola-barang', module: 'kelola_barang', label: 'Kelola Barang' },
    { key: 'analisa-data', module: 'laporan', label: 'Analisa Data' },
    { key: 'aset-gudang', module: 'aset_gudang', label: 'Manajemen Aset Gudang' },
    { key: 'barang-rusak', module: 'barang_rusak', label: 'Barang Rusak' },
  ],
  approval: [
    { key: 'approval-barang-masuk', module: 'barang_masuk', label: 'Barang Masuk' },
    { key: 'approval-barang-keluar', module: 'barang_keluar', label: 'Barang Keluar' },
    { key: 'approval-stock-opname', module: 'stock_opname', label: 'Stock Opname' },
  ],

  laporan: [
    { key: 'laporan', module: 'laporan', label: 'Semua Laporan (Inventaris, Barang Masuk/Keluar, Retur, Stock Opname)' },
  ],
  sistem: [
    { key: 'manajemen-user', module: 'manajemen_user', label: 'Manajemen User' },
    { key: 'manajemen-gudang', module: 'manajemen_gudang', label: 'Manajemen Gudang' },
    { key: 'manajemen-inventaris', module: 'stock_opname', label: 'Manajemen Inventaris' },
    { key: 'settings', module: 'settings', label: 'Settings' },
  ],
};
