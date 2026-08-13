import type {
  DeliveryStatus,
  PurchaseOrderStatus,
  StatusBadgeVariant,
  AssetStatus,
  BarangRusakStatus,
} from '@/types';

interface StatusMeta {
  label: string;
  variant: StatusBadgeVariant;
}

export const ITEM_STATUS_META: Record<'tersedia' | 'menipis' | 'habis', StatusMeta> = {
  tersedia: { label: 'Tersedia', variant: 'success' },
  menipis: { label: 'Menipis', variant: 'warning' },
  habis: { label: 'Habis', variant: 'danger' },
};

export const PO_STATUS_META: Record<PurchaseOrderStatus, StatusMeta> = {
  draft: { label: 'Draft', variant: 'neutral' },
  diproses: { label: 'Diproses', variant: 'warning' },
  dikirim: { label: 'Dikirim', variant: 'info' },
  selesai: { label: 'Selesai', variant: 'success' },
  dibatalkan: { label: 'Dibatalkan', variant: 'danger' },
};

export const DELIVERY_STATUS_META: Record<DeliveryStatus, StatusMeta> = {
  menunggu: { label: 'Menunggu', variant: 'neutral' },
  dijemput: { label: 'Dijemput', variant: 'info' },
  perjalanan: { label: 'Transit', variant: 'warning' },
  terkirim: { label: 'Terkirim', variant: 'success' },
  gagal: { label: 'Gagal', variant: 'danger' },
};

export const ASSET_STATUS_META: Record<AssetStatus, StatusMeta> = {
  aktif: { label: 'Aktif', variant: 'success' },
  rusak: { label: 'Rusak', variant: 'danger' },
  nonaktif: { label: 'Nonaktif', variant: 'neutral' },
};

export const BARANG_RUSAK_STATUS_META: Record<BarangRusakStatus, StatusMeta> = {
  pengecekan: { label: 'Menunggu Pengecekan', variant: 'warning' },
  retur: { label: 'Bisa Diretur', variant: 'info' },
  rusak: { label: 'Rusak', variant: 'danger' },
};

export const JENIS_ASET_META: Record<string, StatusMeta> = {
  tiang: { label: 'Tiang', variant: 'info' },
  odc: { label: 'ODC', variant: 'info' },
  ont: { label: 'ONT', variant: 'info' },
  odp: { label: 'ODP', variant: 'info' },
  olt: { label: 'OLT', variant: 'info' },
  transportasi: { label: 'Transportasi', variant: 'neutral' },
};

export const GENERIC_STATUS_META: Record<string, StatusMeta> = {
  aktif: { label: 'Aktif', variant: 'success' },
  nonaktif: { label: 'Nonaktif', variant: 'neutral' },
  sesuai: { label: 'Sesuai', variant: 'success' },
  selisih: { label: 'Selisih', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  diproses: { label: 'Diproses', variant: 'warning' },
  // Barang Masuk (& modul lain yang kebetulan simpan status berkapital di
  // backend, lihat pkg/constant/cons_barangMasuk.go) — ditambahkan di
  // samping versi huruf kecil di atas yang tetap dipakai modul lain
  // (Barang Keluar/Stock Opname) yang memang simpan huruf kecil.
  Draft: { label: 'Draft', variant: 'warning' },
  Selesai: { label: 'Selesai', variant: 'success' },
};
