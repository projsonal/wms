import type {
  StatusBadgeVariant,
  AssetStatus,
  BarangRusakStatus,
  DeliveryStatus,
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

export const BARANG_SERIAL_STATUS_META: Record<'tersedia' | 'terpasang' | 'rusak', StatusMeta> = {
  tersedia: { label: 'Tersedia', variant: 'success' },
  terpasang: { label: 'Terpasang', variant: 'info' },
  rusak: { label: 'Rusak', variant: 'danger' },
};

export const DELIVERY_STATUS_META: Record<DeliveryStatus, StatusMeta> = {
  menunggu: { label: 'Menunggu', variant: 'neutral' },
  dijemput: { label: 'Menunggu Dijemput', variant: 'warning' },
  perjalanan: { label: 'Dalam Perjalanan', variant: 'info' },
  terkirim: { label: 'Terkirim', variant: 'success' },
  gagal: { label: 'Gagal Kirim', variant: 'danger' },
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

  Draft: { label: 'Draft', variant: 'warning' },
  Selesai: { label: 'Selesai', variant: 'success' },
};
