export interface PermissionModuleDef {
  /** ID unik untuk baris di tabel UI (boleh beda antar baris meski modulnya sama). */
  key: string;
  /**
   * Slug modul PERSIS seperti di backend (lihat pkg/constant/*.go repo gowms,
   * mis. `ModuleKelolaBarang = "kelola_barang"`). Field inilah yang dikirim
   * ke PUT /roles/:id/permissions dan dipakai backend saat RequirePermission
   * mengecek endpoint asli (mis. POST /barang). HARUS sama persis, bukan
   * diturunkan dari path URL frontend.
   */
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

/**
 * PENTING: sebelumnya `module` di sini dihasilkan otomatis dari href nav
 * (`slugFromHref('/home/kelola-barang')` -> "home_kelola-barang"), yang TIDAK PERNAH cocok
 * dengan slug modul backend ("kelola_barang"). Akibatnya: toggle ON di
 * matrix tersimpan ke module yang salah di DB, sementara endpoint asli
 * (mis. POST /barang) memvalidasi lewat
 * `RequirePermission(checker, "kelola_barang", "tambah")` — jadi selalu
 * ditolak walau matrix sudah "ON" untuk baris yang labelnya cocok di UI.
 *
 * Mapping di bawah dicocokkan manual: tiap baris -> endpoint yang benar-benar
 * dipanggil komponen halaman itu (src/lib/api/modules.ts) -> `const Module =
 * constant.Module...` di controller backend yang menangani endpoint itu.
 *
 * Beberapa baris SENGAJA berbagi `module` yang sama (mis. "Pickup & Dropoff"
 * dan "Monitoring Pengiriman" sama-sama module "pengiriman", 5 baris di tab
 * Laporan semuanya module "laporan") karena backend memang cuma expose SATU
 * permission untuk seluruh sub-halaman itu — bukan bug, representasi apa
 * adanya dari granularitas RBAC di backend saat ini.
 */
export const PERMISSION_MODULES: Record<PermissionTabKey, PermissionModuleDef[]> = {
  umum: [
    { key: 'dashboard', module: 'dashboard', label: 'Dashboard' },
    { key: 'pickup-dropoff', module: 'pengiriman', label: 'Pickup & Dropoff' },
    { key: 'purchase-order', module: 'purchase_order', label: 'Purchase Order' },
    { key: 'wms', module: 'manajemen_gudang', label: 'WMS' },
    { key: 'supplier', module: 'supplier', label: 'Supplier' },
    { key: 'inventaris', module: 'stock_opname', label: 'Inventaris' },
    { key: 'barang-masuk', module: 'barang_masuk', label: 'Barang Masuk' },
    { key: 'barang-keluar', module: 'barang_keluar', label: 'Barang Keluar' },
    { key: 'kelola-barang', module: 'kelola_barang', label: 'Kelola Barang' },
    { key: 'cod-monitoring', module: 'cod', label: 'COD Monitoring' },
    { key: 'monitoring-pengiriman', module: 'pengiriman', label: 'Monitoring Pengiriman' },
    { key: 'analisa-data', module: 'laporan', label: 'Analisa Data' },
    { key: 'aset-gudang', module: 'aset_gudang', label: 'Manajemen Aset Gudang' },
    { key: 'barang-rusak', module: 'barang_rusak', label: 'Barang Rusak' },
  ],
  approval: [
    { key: 'approval-po', module: 'purchase_order', label: 'Purchase Order' },
    { key: 'approval-barang-masuk', module: 'barang_masuk', label: 'Barang Masuk' },
    { key: 'approval-barang-keluar', module: 'barang_keluar', label: 'Barang Keluar' },
    { key: 'approval-stock-opname', module: 'stock_opname', label: 'Stock Opname' },
  ],
  // Backend cuma punya SATU permission untuk seluruh jenis laporan
  // (GET /laporan/preview?tipe=... digerbang satu middleware yang sama,
  // tidak dibedakan per tipe) — sebelumnya di sini ditampilkan sebagai 5
  // baris terpisah yang kelihatan independen tapi sebenarnya berbagi satu
  // state yang sama (toggle salah satu = semua ikut berubah, membingungkan).
  // Digabung jadi SATU baris supaya jujur sesuai kenyataan di backend.
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
