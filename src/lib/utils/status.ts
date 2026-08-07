import type {
  DeliveryStatus,
  PurchaseOrderStatus,
  StatusBadgeVariant,
  TaskPriority,
  TaskStatus,
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

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  baru: { label: 'Baru', variant: 'info' },
  proses: { label: 'Proses', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  terlambat: { label: 'Terlambat', variant: 'danger' },
};

export const TASK_PRIORITY_META: Record<TaskPriority, StatusMeta> = {
  rendah: { label: 'Rendah', variant: 'neutral' },
  sedang: { label: 'Sedang', variant: 'warning' },
  tinggi: { label: 'Tinggi', variant: 'danger' },
};

export const GENERIC_STATUS_META: Record<string, StatusMeta> = {
  aktif: { label: 'Aktif', variant: 'success' },
  nonaktif: { label: 'Nonaktif', variant: 'neutral' },
  sesuai: { label: 'Sesuai', variant: 'success' },
  selisih: { label: 'Selisih', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  diproses: { label: 'Diproses', variant: 'warning' },
};
