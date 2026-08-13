import type { Asset, BarangRusak, InventoryRecord, Item, ManagedUser, Supplier, UserRole } from '@/types';
import type { RawAsset, RawBarang, RawBarangRusak, RawStockOpname, RawSupplier, RawUser } from '@/lib/api/raw-types';

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
    categoryId: raw.kategoriId ? String(raw.kategoriId) : undefined,
    unit: raw.satuan?.singkatan ?? raw.satuan?.nama ?? '-',
    unitId: raw.satuanId ? String(raw.satuanId) : undefined,
    stock: raw.stok,
    minStock: raw.stokMinimum,
    price: raw.hargaBeli,
    weightGram: raw.beratGram ?? undefined,
    warehouseId: '',
    warehouseName: '-',
    status: computeItemStatus(raw.stok, raw.stokMinimum),
    updatedAt: raw.updatedAt,
    isProtected: raw.isProtected ?? false,
    approvalStatus: raw.approvalStatus ?? 'disetujui',
    catatanApproval: raw.catatanApproval,
    submittedByUserId: raw.diajukanOleh ?? undefined,
  };
}

/** internal/controller/barang BarangRequest — kategori_id & satuan_id WAJIB
 * ID numerik (bukan teks), jadi form pemanggil harus mengisi categoryId/
 * unitId dari dropdown /gudang/kategori & /gudang/satuan (lihat kategoriApi
 * & satuanApi di modules.ts), bukan mengetik bebas. */
export function mapItemToBarangPayload(item: Partial<Item>): Record<string, unknown> {
  return {
    kode_barang: item.sku,
    nama: item.name,
    harga_beli: item.price,
    // Stok DIKIRIM SEBAGAI NILAI MUTLAK, bukan tambah/kurang — WAJIB
    // selalu disertakan (bukan cuma saat sengaja diubah), karena backend
    // Update() sekarang menimpa kolom stok dengan nilai ini setiap kali
    // form disimpan. Kalau field ini hilang dari payload, stok akan
    // ke-reset jadi 0 tanpa sengaja setiap kali "Ubah Barang" disimpan.
    stok: item.stock ?? 0,
    stok_minimum: item.minStock,
    berat_gram: item.weightGram ?? null,
    kategori_id: item.categoryId ? Number(item.categoryId) : undefined,
    satuan_id: item.unitId ? Number(item.unitId) : undefined,
    deskripsi: item.deskripsi ?? '',
  };
}

/** internal/model/supplier.go -> Supplier (types/index.ts). */
export function mapSupplierRaw(raw: RawSupplier): Supplier {
  return {
    id: String(raw.id),
    code: raw.kode,
    name: raw.nama,
    contactPerson: raw.pic ?? '-',
    phone: raw.telepon ?? '-',
    courierPartners: (raw.kerjasamaKurir ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    address: raw.alamat ?? '-',
    npwp: raw.npwp ?? undefined,
    notes: raw.catatan ?? undefined,
    // totalOrders/rating: dihitung backend dari data Pengiriman yang
    // memakai kurir-kurir di courierPartners (lihat SupplierResponse di
    // internal/controller/supplier/struct.go) — bukan lagi hardcode 0.
    totalOrders: raw.totalOrder ?? 0,
    rating: raw.rating ?? 0,
    status: raw.isActive ? 'aktif' : 'nonaktif',
    isProtected: raw.isProtected ?? false,
  };
}

/** internal/model/asset.go -> Asset (types/index.ts). */
export function mapAssetRaw(raw: RawAsset): Asset {
  return {
    id: String(raw.id),
    nama: raw.nama,
    jenisAset: raw.jenisAset,
    gudangId: String(raw.gudangId),
    gudangNama: raw.gudang?.nama ?? '-',
    labelRsd: raw.labelRsd || undefined,
    kodeBa: raw.kodeBa || undefined,
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    status: raw.status,
    keterangan: raw.keterangan,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/** internal/model/barang_rusak.go -> BarangRusak (types/index.ts). */
export function mapBarangRusakRaw(raw: RawBarangRusak): BarangRusak {
  return {
    id: String(raw.id),
    barangId: raw.barangId ? String(raw.barangId) : undefined,
    labelBarang: raw.labelBarang,
    namaBarang: raw.namaBarang,
    keterangan: raw.keterangan,
    jenisBarang: raw.jenisBarang || undefined,
    status: raw.status,
    dilaporkanOleh: String(raw.dilaporkanOleh),
    pelapor: raw.pelapor?.fullName,
    dicekOleh: raw.dicekOleh ? String(raw.dicekOleh) : undefined,
    pemeriksa: raw.pemeriksa?.fullName,
    dicekPada: raw.dicekPada || undefined,
    createdAt: raw.createdAt,
  };
}

/** internal/model/stock_opname.go -> InventoryRecord[] (types/index.ts).
 * SATU dokumen Stock Opname berisi BANYAK item — diratakan (flatten) jadi
 * satu baris per item supaya tetap cocok tampil di tabel "per SKU" yang
 * sudah ada (Manajemen Inventaris & Inventaris overview), sambil tetap
 * membawa nomorOpname & status dokumen induknya untuk konteks. Hanya
 * dokumen berstatus "selesai" yang dianggap otoritatif (draft belum final,
 * jangan dicampur ke ringkasan stok). */
export function mapStockOpnameToRecords(raw: RawStockOpname): InventoryRecord[] {
  if (!raw.items || raw.items.length === 0) return [];
  return raw.items.map((item) => ({
    id: `${raw.id}-${item.id}`,
    itemName: item.barang?.nama ?? '-',
    sku: item.barang?.kodeBarang ?? '-',
    warehouseName: raw.gudang?.nama ?? '-',
    quantity: item.stokSistem,
    unit: '-',
    lastOpname: raw.tanggal,
    variance: item.selisih,
    status: item.selisih === 0 ? 'sesuai' : 'selisih',
  }));
}

/** internal/controller/users Response -> ManagedUser (types/index.ts).
 * `roleName` datang sebagai string bebas dari backend (mengikuti nama role
 * yang dibuat lewat Manajemen Role) — dijaga ke salah satu dari 3 role baku
 * aplikasi, fallback 'karyawan' kalau backend mengirim nama role lain yang
 * belum dikenal frontend, supaya tidak crash. */
export function mapUserRaw(raw: RawUser): ManagedUser {
  const knownRoles: UserRole[] = ['super_admin', 'admin', 'karyawan'];
  const role = (knownRoles as string[]).includes(raw.roleName)
    ? (raw.roleName as UserRole)
    : 'karyawan';
  return {
    id: String(raw.id),
    name: raw.fullName,
    username: raw.username,
    email: raw.email,
    role,
    status: raw.isActive ? 'aktif' : 'nonaktif',
    // isOnline: status login REAL-TIME (punya sesi aktif sekarang) —
    // dipakai kolom "Status" di tabel Manajemen User, BEDA dari `status`
    // di atas (itu akun diaktifkan/dinonaktifkan admin, bukan soal
    // sedang login atau tidak).
    isOnline: raw.isOnline ?? false,
    lastLogin: raw.lastLoginAt ?? undefined,
  };
}
