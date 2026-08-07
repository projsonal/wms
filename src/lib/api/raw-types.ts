/**
 * Bentuk mentah respons backend gostock SETELAH dilewatkan `camelizeKeysDeep`
 * (lihat lib/api/client.ts) — field masih bahasa Indonesia (nama Go struct
 * di internal/model/*.go), BEDA dari tipe UI di `types/index.ts` yang sudah
 * di-Inggris-kan untuk kebutuhan tampilan. File ini adalah "kontrak" dengan
 * backend; `lib/api/modules.ts` yang menerjemahkannya ke tipe UI.
 */

export interface RawKategori {
  id: number;
  nama: string;
}

export interface RawSatuan {
  id: number;
  nama: string;
  singkatan: string;
}

export interface RawGudang {
  id: number;
  nama: string;
  alamat?: string;
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
  isActive: boolean;
  deskripsi?: string;
  updatedAt: string;
}

/** internal/model/supplier.go */
export interface RawSupplier {
  id: number;
  kode: string;
  nama: string;
  pic?: string | null;
  telepon?: string;
  email?: string;
  alamat?: string;
  npwp?: string | null;
  isActive: boolean;
  catatan?: string;
  updatedAt: string;
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
  status: 'draft' | 'diajukan' | 'disetujui' | 'ditolak' | 'dibatalkan';
  tanggalPo: string;
  catatanPengajuan?: string;
  catatanApproval?: string;
  totalEstimasi: number;
  items?: RawPurchaseOrderItem[];
  updatedAt: string;
}

/** internal/model/pengiriman.go */
export interface RawPengiriman {
  id: number;
  nomorPengiriman: string;
  gudangAsalId: number;
  gudangAsal?: RawGudang;
  jenisPengambilan: 'pickup' | 'dropoff';
  namaPenerima: string;
  teleponPenerima?: string;
  alamatTujuan?: string;
  namaKurir?: string;
  teleponKurir?: string;
  status: 'draft' | 'terjadwal' | 'dikirim' | 'terkirim' | 'dibatalkan';
  tanggalKirim: string;
  estimasiTiba?: string | null;
  waktuTerkirim?: string | null;
  catatan?: string;
  lastLat?: number | null;
  lastLng?: number | null;
  lastLocationAt?: string | null;
}
