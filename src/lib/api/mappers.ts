import type { Asset, BarangRusak, BarangSerialUnit, Item, ManagedUser, StokGudangRecord, UserDeviceSession, UserRole } from '@/types';
import type { RawAsset, RawBarang, RawBarangRusak, RawBarangSerial, RawRingkasanStokRow, RawUser, RawUserSession } from '@/lib/api/raw-types';

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
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    isProtected: raw.isProtected ?? false,
    isSerialized: raw.isSerialized ?? false,
    merek: raw.merek || undefined,
    tipe: raw.tipe || undefined,
    approvalStatus: raw.approvalStatus ?? 'disetujui',
    catatanApproval: raw.catatanApproval,
    submittedByUserId: raw.diajukanOleh ?? undefined,
    delegatedToUserId: raw.didelegasikanKe ?? undefined,
    delegatedToName: raw.didelegasikan?.fullName,
  };
}

export function mapItemToBarangPayload(item: Partial<Item>): Record<string, unknown> {
  return {
    kode_barang: item.sku,
    nama: item.name,
    harga_beli: item.price,

    stok: item.stock ?? 0,
    stok_minimum: item.minStock,
    berat_gram: item.weightGram ?? null,
    kategori_id: item.categoryId ? Number(item.categoryId) : undefined,
    satuan_id: item.unitId ? Number(item.unitId) : undefined,
    deskripsi: item.deskripsi ?? '',
    is_serialized: item.isSerialized ?? false,
    merek: item.merek ?? '',
    tipe: item.tipe ?? '',
  };
}

export function mapBarangSerialToUnit(raw: RawBarangSerial): BarangSerialUnit {
  return {
    id: String(raw.id),
    barangId: String(raw.barangId),
    barangNama: raw.barang?.nama,
    barangMerek: raw.barang?.merek || undefined,
    barangTipe: raw.barang?.tipe || undefined,
    serialNumber: raw.serialNumber,
    status: raw.status,
    warehouseId: raw.gudangId ? String(raw.gudangId) : undefined,
    warehouseName: raw.gudang?.nama,
    catatan: raw.catatan,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    nomorBarangMasuk: raw.nomorBarangMasuk || undefined,
    nomorBarangKeluar: raw.nomorBarangKeluar || undefined,
  };
}

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
    merek: raw.merek || undefined,
    tipe: raw.tipe || undefined,
    parentAssetId: raw.parentAssetId ? String(raw.parentAssetId) : undefined,
    jumlahPort: raw.jumlahPort ?? 0,
    barangId: raw.barangId ? String(raw.barangId) : undefined,
    kodeBarang: raw.barang?.kodeBarang || undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function mapBarangRusakRaw(raw: RawBarangRusak): BarangRusak {
  return {
    id: String(raw.id),
    barangId: raw.barangId ? String(raw.barangId) : undefined,
    labelBarang: raw.labelBarang,
    namaBarang: raw.namaBarang,
    kodeBarang: raw.barang?.kodeBarang || undefined,
    merek: raw.barang?.merek || undefined,
    tipe: raw.barang?.tipe || undefined,
    serialNumber: raw.serialNumber || undefined,
    keterangan: raw.keterangan,
    fotoUrl: raw.fotoUrl || undefined,
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

export function mapRingkasanStokRow(raw: RawRingkasanStokRow): StokGudangRecord {
  return {
    id: `${raw.barangId}-${raw.gudangId}`,
    barangId: String(raw.barangId),
    sku: raw.kodeBarang,
    itemName: raw.namaBarang,
    gudangId: String(raw.gudangId),
    warehouseName: raw.namaGudang,
    quantity: raw.stok,
  };
}

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
    phoneNumber: raw.phoneNumber || undefined,
    role,
    status: raw.isActive ? 'aktif' : 'nonaktif',

    isOnline: raw.isOnline ?? false,
    lastLogin: raw.lastLoginAt ?? undefined,
  };
}

export function mapUserSessionRaw(raw: RawUserSession): UserDeviceSession {
  return {
    id: String(raw.id),
    browser: raw.browser || undefined,
    browserVersion: raw.browserVersion || undefined,
    os: raw.os || undefined,
    osVersion: raw.osVersion || undefined,
    deviceType: raw.deviceType || undefined,
    ipAddress: raw.ipAddress || undefined,
    location: raw.location || undefined,
    createdAt: raw.createdAt,
  };
}
