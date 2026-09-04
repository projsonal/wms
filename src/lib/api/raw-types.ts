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
  isProtected?: boolean;
  updatedAt: string;
}

export interface RawBarangKeluarItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  qty: number;
  jumlahTerpasang: number;
  jumlahSisa: number;
  catatanSpesifikasi?: string;
}

export interface RawSpesifikasiRecapRow {
  barangId: number;
  namaBarang: string;
  kodeBarang: string;
  satuan?: string;
  totalTerpakai: number;
  totalTerpasang: number;
  totalSisa: number;
}

// RawSpesifikasiListRow: baris flat 1 item barang keluar (dokumennya sudah
// selesai) — dipakai bagian Spesifikasi di modal Detail Stok (Kelola
// Barang), mirip pola "Daftar Unit" di Nomor Seri tapi untuk progres
// terpakai/terpasang/sisa.
export interface RawSpesifikasiListRow {
  itemId: number;
  barangKeluarId: number;
  nomorPengeluaran: string;
  tanggal: string;
  keperluan?: string;
  gudangId: number;
  namaGudang?: string;
  barangId: number;
  namaBarang: string;
  kodeBarang: string;
  satuan?: string;
  qty: number;
  jumlahTerpasang: number;
  jumlahSisa: number;
  catatanSpesifikasi?: string;
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
  isProtected?: boolean;
  updatedAt: string;
}

export type PengajuanBarangStatus = 'diajukan' | 'disetujui' | 'ditolak';
export type PengajuanBarangJenis = 'masuk' | 'keluar' | 'rusak' | 'template';

export interface RawPengajuanBarangItem {
  id: number;
  barangId: number;
  barang?: RawBarang;
  qty: number;
}

// RawPengajuanTemplate: satu formulir kosong (docx/pdf) yang diunggah admin
// — dipilih lewat dropdown "Template Formulir" saat membuat pengajuan jenis
// "template" (menggantikan "Pengajuan ke Atasan"/jenis "umum" yang lama).
export interface RawPengajuanTemplate {
  id: number;
  nama: string;
  deskripsi?: string;
  isActive: boolean;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: number;
  pengunggah?: { id: number; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface RawPengajuanBarang {
  id: number;
  nomorPengajuan: string;
  jenis: PengajuanBarangJenis;
  gudangId: number;
  gudang?: RawGudang;
  tanggal: string;
  keperluan: string;
  perihal?: string;
  templateId?: number | null;
  template?: RawPengajuanTemplate;
  status: PengajuanBarangStatus;

  diajukanOleh: number;
  pengaju?: { id: number; fullName: string };
  namaPencatat?: string;
  jabatanPencatat?: string;

  diprosesOleh?: number | null;
  pemroses?: { id: number; fullName: string };
  namaGa?: string;
  jabatanGa?: string;
  diprosesPada?: string | null;
  catatanProses?: string;

  barangKeluarId?: number | null;
  barangKeluar?: RawBarangKeluar;

  barangMasukId?: number | null;
  barangMasuk?: RawBarangMasuk;

  barangRusak?: RawBarangRusak[];

  items?: RawPengajuanBarangItem[];
  createdAt: string;
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
  nilaiAset?: number;
  parentAssetId?: number | null;
  jumlahPort?: number;

  nopol?: string;
  jenisTransportasi?: string;
  nomorBpkb?: string;
  tahunKendaraan?: number;

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

  // Merek/kodeBarang input manual — dipakai kalau barangId kosong (barang
  // belum terdaftar di katalog Kelola Barang). Kalau barangId terisi,
  // mapBarangRusakRaw memprioritaskan barang.merek/barang.kodeBarang.
  merek?: string;
  kodeBarang?: string;

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
  lastActiveAt?: string;
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
  merek?: string;
  tipe?: string;
  gudangId: number;
  namaGudang: string;
  stok: number;
}

// RawBarangDetailStok: ringkasan real-time "berapa masuk, berapa keluar,
// stok per gudang berapa" untuk 1 barang — dipakai panel detail di Kelola
// Barang, dihitung fresh oleh backend setiap request (bukan cache).
export interface RawBarangDetailStok {
  barangId: number;
  kodeBarang: string;
  namaBarang: string;
  totalStok: number;
  totalMasuk: number;
  totalKeluar: number;
  perGudang: RawRingkasanStokRow[];
}