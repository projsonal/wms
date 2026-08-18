/**
 * Bentuk mentah respons backend gostock SETELAH dilewatkan `camelizeKeysDeep`
 * (lihat lib/api/client.ts) — field masih bahasa Indonesia (nama Go struct
 * di internal/model/*.go), BEDA dari tipe UI di `types/index.ts` yang sudah
 * di-Inggris-kan untuk kebutuhan tampilan. File ini adalah "kontrak" dengan
 * backend; `lib/api/modules.ts` yang menerjemahkannya ke tipe UI.
 */

/** Status dokumen draft-berjalan (Barang Masuk/Keluar, Stock Opname) —
 * dipakai berulang di beberapa Raw*, diekstrak jadi satu alias supaya
 * tidak duplikat union literal yang sama persis (SonarQube S4323). */
export type DraftDocumentStatus = 'draft' | 'selesai' | 'dibatalkan';

/** Status Barang Masuk SAJA — backend cons_barangMasuk.go SENGAJA
 * menyimpan versi BERKAPITAL ("Draft"/"Selesai"/"Dibatalkan"), beda
 * dengan Barang Keluar & Stock Opname yang simpan huruf kecil biasa
 * (DraftDocumentStatus di atas) — inkonsistensi ini ada di backend itu
 * sendiri, bukan salah frontend. JANGAN disatukan lagi dengan
 * DraftDocumentStatus, itu penyebab bug lama (status Barang Masuk selain
 * "Draft" gagal ke-lookup di frontend). */
export type BarangMasukStatus = 'Draft' | 'Selesai' | 'Dibatalkan';

export interface RawKategori {
  id: number;
  nama: string;
}

export interface RawSatuan {
  id: number;
  nama: string;
  singkatan: string;
}

export interface RawRak {
  id: number;
  kodeRak: string;
  gudangId: number;
  kapasitas: number;
  terisi: number;
  status: 'kosong' | 'terisi_sebagian' | 'penuh';
}

export interface RawGudang {
  id: number;
  nama: string;
  /** Kode singkat gudang (mis. "BBU", "MAHANG") — prefix label RSD aset,
   * lihat internal/model/asset.go & internal/controller/asset. */
  kode?: string;
  alamat?: string;
  pic?: string;
  /** Nomor kontak gudang — "No. Telepon Pengirim" di resi pengiriman. */
  telepon?: string;
  kapasitas?: number;
  latitude?: number | null;
  longitude?: number | null;
  /** Daftar rak di gudang ini — dipakai menghitung "Kapasitas Terpakai"
   * (SUM terisi) & "Total Barang" (SUM terisi juga, karena unit yang
   * "terisi" di rak = unit fisik yang ada di gudang itu) secara otomatis,
   * TANPA sensor IoT — angka `terisi` per rak sudah mutakhir sendiri lewat
   * proses Barang Masuk/Keluar/Stock Opname di backend (lihat
   * adjustRak() di internal/repositories/barang_masuk/barang_masuk_repos.go).
   * Catatan: hanya akurat untuk item yang di-assign ke rak spesifik saat
   * input dokumen (field rak_id) — item tanpa rak_id tidak terhitung. */
  raks?: RawRak[];
  isProtected?: boolean;
}

/** internal/model/barang.go */
export interface RawBarang {
  id: number;
  kodeBarang: string;
  nama: string;
  kategoriId: number;
  kategori?: RawKategori;
  satuanId: number;
  satuan?: RawSatuan;
  hargaBeli: number;
  stokMinimum: number;
  stok: number;
  /** Berat satuan dalam gram, opsional — dipakai di resi pengiriman. */
  beratGram?: number | null;
  isActive: boolean;
  isProtected?: boolean;
  deskripsi?: string;
  /** Alur persetujuan (khusus barang yang dibuat role admin) — lihat
   * internal/controller/barang Approve()/Reject(). */
  approvalStatus?: 'disetujui' | 'menunggu' | 'ditolak';
  diajukanOleh?: number | null;
  disetujuiOleh?: number | null;
  catatanApproval?: string;
  direviewPada?: string | null;
  updatedAt: string;
}

/** internal/model/supplier.go */
export interface RawSupplier {
  id: number;
  kode: string;
  nama: string;
  pic?: string | null;
  telepon?: string;
  /** Daftar kurir mitra dipisah koma (mis. "JNE,J&T,Lalamove") — dipakai
   * backend mencocokkan ke Pengiriman.namaKurir untuk menghitung
   * totalOrder/rating (lihat SupplierResponse di internal/controller/
   * supplier/struct.go). Menggantikan field `email` lama. */
  kerjasamaKurir?: string;
  alamat?: string;
  npwp?: string | null;
  isActive: boolean;
  isProtected?: boolean;
  catatan?: string;
  /** Dihitung backend saat List/Detail, bukan kolom tersimpan. */
  totalOrder?: number;
  rating?: number;
  updatedAt: string;
}

/** internal/model/barang_masuk.go */
export interface RawBarangMasukItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  rakId?: number | null;
  qty: number;
  hargaSatuan: number;
}

export interface RawBarangMasuk {
  id: number;
  nomorPenerimaan: string;
  purchaseOrderId?: number | null;
  supplierId?: number | null;
  supplier?: RawSupplier;
  gudangId: number;
  gudang?: RawGudang;
  tanggal: string;
  catatan?: string;
  status: BarangMasukStatus;
  items?: RawBarangMasukItem[];
  updatedAt: string;
}

/** internal/model/barang_keluar.go */
export interface RawBarangKeluarItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  rakId?: number | null;
  qty: number;
}

export interface RawBarangKeluar {
  id: number;
  nomorPengeluaran: string;
  gudangId: number;
  gudang?: RawGudang;
  tanggal: string;
  keperluan: string;
  penerima?: string;
  status: DraftDocumentStatus;
  items?: RawBarangKeluarItem[];
  updatedAt: string;
}

/** internal/model/asset.go */
export interface RawAsset {
  id: number;
  nama: string;
  jenisAset: 'tiang' | 'odc' | 'ont' | 'odp' | 'olt' | 'transportasi';
  gudangId: number;
  gudang?: { id: number; nama: string; kode?: string };
  labelRsd?: string;
  kodeBa?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: 'aktif' | 'rusak' | 'nonaktif';
  keterangan?: string;
  ipAddress?: string;
  pingStatus?: 'online' | 'offline' | 'unknown';
  lastPingAt?: string | null;
  parentAssetId?: number | null;
  jumlahPort?: number;
  createdAt: string;
  updatedAt: string;
}

/** internal/model/barang_rusak.go */
export interface RawBarangRusak {
  id: number;
  barangId?: number | null;
  barang?: { id: number; nama: string; kodeBarang: string };
  labelBarang: string;
  namaBarang: string;
  keterangan?: string;
  fotoUrl?: string;
  jenisBarang?: 'retur' | 'rusak' | '';
  status: 'pengecekan' | 'retur' | 'rusak';
  dilaporkanOleh: number;
  pelapor?: { id: number; fullName: string; username: string };
  dicekOleh?: number | null;
  pemeriksa?: { id: number; fullName: string; username: string };
  dicekPada?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** internal/controller/users Response struct. */
export interface RawUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  isOnline?: boolean;
  is2FaEnabled?: boolean;
  lastLoginAt?: string | null;
}

/** internal/model/stock_opname.go — modul Stock Opname, dokumen berisi
 * BANYAK item sekaligus per sesi hitung fisik (bukan satu-baris-satu-
 * penyesuaian seperti anggapan versi lama frontend). */
export interface RawStockOpnameItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  stokSistem: number;
  stokFisik: number;
  selisih: number;
  catatan?: string;
}

export interface RawStockOpname {
  id: number;
  nomorOpname: string;
  gudangId: number;
  gudang?: RawGudang;
  status: DraftDocumentStatus;
  tanggal: string;
  catatan?: string;
  completedAt?: string | null;
  items?: RawStockOpnameItem[];
}

/** internal/model/po.go */
export interface RawPurchaseOrderItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  qty: number;
  hargaSatuan: number;
}

export interface RawPurchaseOrder {
  id: number;
  nomorPo: string;
  supplierId: number;
  supplier?: RawSupplier;
  status: 'Draft' | 'Diajukan' | 'Disetujui' | 'Ditolak' | 'Dibatalkan';
  tanggalPo: string;
  catatanPengajuan?: string;
  catatanApproval?: string;
  totalEstimasi: number;
  isProtected?: boolean;
  items?: RawPurchaseOrderItem[];
  updatedAt: string;
}

/** internal/model/pengiriman.go */
export interface RawPengiriman {
  id: number;
  nomorPengiriman: string;
  gudangAsalId: number;
  gudangAsal?: RawGudang;
  /** Dokumen Barang Keluar yang jadi dasar pengiriman ini (kalau ada) —
   * dipakai sebagai "Order ID" & daftar item (SKU/qty/berat) di resi. */
  barangKeluarId?: number | null;
  barangKeluar?: RawBarangKeluar;
  jenisPengambilan: 'pickup' | 'dropoff';
  namaPenerima: string;
  teleponPenerima?: string;
  alamatTujuan?: string;
  destLat?: number | null;
  destLng?: number | null;
  namaKurir?: string;
  teleponKurir?: string;
  status: 'Draft' | 'Dijadwalkan' | 'Dalam Perjalanan' | 'Terkirim' | 'Dibatalkan';
  tanggalKirim: string;
  estimasiTiba?: string | null;
  waktuTerkirim?: string | null;
  catatan?: string;
  lastLat?: number | null;
  lastLng?: number | null;
  lastLocationAt?: string | null;
  isProtected?: boolean;
}
