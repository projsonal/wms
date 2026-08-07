import type { Item, Supplier } from '@/types';
import type { RawBarang, RawSupplier } from '@/lib/api/raw-types';

/**
 * internal/model/barang.go -> Item (types/index.ts).
 * Catatan jujur: `Barang` di backend TIDAK punya relasi ke gudang (tidak
 * ada `gudang_id` di tabel `barang` — stok agregat lintas gudang, lihat
 * kolom `stok`). Karena itu `warehouseId`/`warehouseName` di sini diisi
 * placeholder kosong; kalau butuh breakdown stok per gudang, itu perlu
 * endpoint/kolom baru di backend (mis. tabel `barang_gudang`), bukan
 * sekadar penyesuaian nama field di frontend.
 */
function computeItemStatus(stok: number, stokMinimum: number): Item['status'] {
  if (stok <= 0) {
    return 'habis';
  }
  if (stokMinimum > 0 && stok <= stokMinimum) {
    return 'menipis';
  }
  return 'tersedia';
}

export function mapBarangToItem(raw: RawBarang): Item {
  return {
    id: String(raw.id),
    sku: raw.kodeBarang,
    name: raw.nama,
    category: raw.kategori?.nama ?? '-',
    unit: raw.satuan?.singkatan ?? raw.satuan?.nama ?? '-',
    stock: raw.stok,
    minStock: raw.stokMinimum,
    price: raw.hargaBeli,
    warehouseId: '',
    warehouseName: '-',
    status: computeItemStatus(raw.stok, raw.stokMinimum),
    updatedAt: raw.updatedAt,
  };
}

export function mapItemToBarangPayload(item: Partial<Item>): Record<string, unknown> {
  return {
    kode_barang: item.sku,
    nama: item.name,
    harga_beli: item.price,
    stok_minimum: item.minStock,
    // kategori_id & satuan_id: form UI saat ini kirim nama teks (category/unit),
    // tapi backend butuh ID numerik dari /gudang/kategori & /gudang/satuan.
    // Perlu dropdown yang fetch daftar itu dulu, bukan text input bebas —
    // lihat catatan integrasi di ItemsManagement.tsx.
  };
}

/** internal/model/supplier.go -> Supplier (types/index.ts). */
export function mapSupplierRaw(raw: RawSupplier): Supplier {
  return {
    id: String(raw.id),
    name: raw.nama,
    contactPerson: raw.pic ?? '-',
    phone: raw.telepon ?? '-',
    email: raw.email ?? '-',
    address: raw.alamat ?? '-',
    // Backend tidak menghitung totalOrders/rating di tabel supplier —
    // butuh JOIN ke purchase_order kalau mau angka asli, untuk sekarang 0.
    totalOrders: 0,
    rating: 0,
    status: raw.isActive ? 'aktif' : 'nonaktif',
  };
}
