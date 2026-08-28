

export type DraftDocumentStatus = 'draft' | 'selesai' | 'dibatalkan';

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

export interface RawBarangSerial {
  id: number;
  barangId: number;
  barang?: RawBarang;
  serialNumber: string;
  status: 'tersedia' | 'terpasang' | 'rusak';
  gudangId?: number | null;
  gudang?: RawGudang;
  barangMasukItemId?: number | null;
  barangKeluarItemId?: number | null;
  catatan?: string;
  createdAt: string;
  updatedAt: string;

  nomorBarangMasuk?: string;
  nomorBarangKeluar?: string;
}

export interface RawGudang {
  id: number;
  nama: string;

  kode?: string;
  alamat?: string;
  pic?: string;

  telepon?: string;
  kapasitas?: number;
  latitude?: number | null;
  longitude?: number | null;
  isProtected?: boolean;

  unitTersedia?: number;
  skuTersedia?: number;
}

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

  beratGram?: number | null;
  isActive: boolean;
  isProtected?: boolean;

  isSerialized?: boolean;
  merek?: string;
  tipe?: string;
  deskripsi?: string;

  approvalStatus?: 'disetujui' | 'menunggu' | 'ditolak';
  diajukanOleh?: number | null;
  disetujuiOleh?: number | null;
  catatanApproval?: string;
  direviewPada?: string | null;

  didelegasikanKe?: number | null;
  didelegasikan?: { id: number; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RawBarangMasukItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  qty: number;
  hargaSatuan: number;
}

export interface RawBarangMasuk {
  id: number;
  nomorPenerimaan: string;
  gudangId: number;
  gudang?: RawGudang;
  tanggal: string;
  catatan?: string;
  status: BarangMasukStatus;
  items?: RawBarangMasukItem[];
  updatedAt: string;
}

export interface RawBarangKeluarItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
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
  merek?: string;
  tipe?: string;
  parentAssetId?: number | null;
  jumlahPort?: number;

  barangId?: number | null;
  barang?: { id: number; kodeBarang: string; nama: string };
  createdAt: string;
  updatedAt: string;
}

export interface RawBarangRusak {
  id: number;
  barangId?: number | null;
  barang?: { id: number; nama: string; kodeBarang: string; merek?: string; tipe?: string };
  labelBarang: string;
  namaBarang: string;

  serialNumber?: string;
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

export interface RawUserSession {
  id: number;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: string;
  ipAddress?: string;
  location?: string;
  createdAt: string;
}

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

export interface RawRingkasanStokRow {
  barangId: number;
  kodeBarang: string;
  namaBarang: string;
  gudangId: number;
  namaGudang: string;
  stok: number;
}

