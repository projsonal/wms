import { apiClient, downloadFile, uploadFile } from '@/lib/api/client';
import { createResourceApi } from '@/lib/api/resource';
import { mapAssetRaw, mapBarangRusakRaw, mapBarangSerialToUnit, mapBarangToItem, mapItemToBarangPayload, mapRingkasanStokRow, mapUserRaw, mapUserSessionRaw } from '@/lib/api/mappers';
import type {
  RawAsset,
  RawBarang,
  RawBarangDetailStok,
  RawBarangKeluar,
  RawBarangKeluarItem,
  RawBarangMasuk,
  RawBarangRusak,
  RawBarangSerial,
  RawGudang,
  RawPengajuanBarang,
  RawPengajuanTemplate,
  RawRingkasanStokRow,
  RawSpesifikasiListRow,
  RawSpesifikasiRecapRow,
  RawStockOpname,
  RawUser,
  RawUserSession,
} from '@/lib/api/raw-types';
import type {
  Asset,
  BarangRusak,
  BarangSerialUnit,
  Delivery,
  Item,
  JenisAset,
  ManagedUser,
  PaginatedResult,
  StokGudangRecord,
  UserDeviceSession,
  UserRole,
  Warehouse,
} from '@/types';
import type { ListParams } from '@/lib/api/resource';
import type { ActivityItem } from '@/component/roles_dashboard/RecentActivityCard';

export const itemsApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Item>> => {
    const { data, meta } = await apiClient.getPaginated<RawBarang>(
      `/barang${buildQuery(params)}`,
    );
    return {
      data: data.map(mapBarangToItem),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<Item> => mapBarangToItem(await apiClient.get<RawBarang>(`/barang/${id}`)),
  create: (payload: Partial<Item>) => apiClient.post<RawBarang>('/barang', mapItemToBarangPayload(payload)),
  update: (id: string, payload: Partial<Item>) =>
    apiClient.put<RawBarang>(`/barang/${id}`, mapItemToBarangPayload(payload)),
  remove: (id: string) => apiClient.delete<void>(`/barang/${id}`),

  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawBarang>(`/barang/${id}/protect`, { is_protected: isProtected }),

  approve: (id: string) => apiClient.patch<RawBarang>(`/barang/${id}/approve`, {}),

  reject: (id: string, catatan: string) =>
    apiClient.patch<RawBarang>(`/barang/${id}/reject`, { catatan }),

  delegasikan: (id: string, userId: string) =>
    apiClient.patch<RawBarang>(`/barang/${id}/delegasikan`, { user_id: Number(userId) }),

  batalkanDelegasi: (id: string) => apiClient.patch<RawBarang>(`/barang/${id}/batalkan-delegasi`, {}),

  detailStok: (id: string) => apiClient.get<RawBarangDetailStok>(`/barang/${id}/detail-stok`),

  summary: () =>
    apiClient.get<{ totalBarang: number; stokMenipis: number; totalNilaiInventaris: number }>(
      '/barang/summary',
    ),

  nextSku: (kategoriId?: string, tipe?: string, merek?: string, beratGram?: number) => {
    const params = new URLSearchParams();
    if (kategoriId) params.set('kategori_id', kategoriId);
    if (tipe) params.set('tipe', tipe);
    if (merek) params.set('merek', merek);
    if (beratGram !== undefined) params.set('berat_gram', String(beratGram));
    const qs = params.toString();
    const separator = qs ? `?${qs}` : '';
    return apiClient.get<{ sku: string }>(`/barang/next-sku${separator}`);
  },

  checkSku: (sku: string, excludeId?: string) => {
    const params = new URLSearchParams({ sku });
    if (excludeId) params.set('exclude_id', excludeId);
    return apiClient.get<{ available: boolean }>(`/barang/check-sku?${params.toString()}`);
  },
};

export const barangSerialApi = {
  list: async (params?: ListParams & { barangId?: string; gudangId?: string; status?: string; barangMasukItemId?: string; barangKeluarItemId?: string; urutan?: 'fifo' }): Promise<PaginatedResult<BarangSerialUnit>> => {
    const { barangId, gudangId, status, barangMasukItemId, barangKeluarItemId, urutan, ...listParams } = params ?? {};
    const query = buildQuery(listParams);
    const extra = [
      barangId ? `barang_id=${barangId}` : '',
      gudangId ? `gudang_id=${gudangId}` : '',
      status ? `status=${status}` : '',
      barangMasukItemId ? `barang_masuk_item_id=${barangMasukItemId}` : '',
      barangKeluarItemId ? `barang_keluar_item_id=${barangKeluarItemId}` : '',
      urutan ? `urutan=${urutan}` : '',
    ].filter(Boolean).join('&');
    const separator = query ? '&' : '?';
    const url = extra ? `/barang-serial${query}${separator}${extra}` : `/barang-serial${query}`;
    const { data, meta } = await apiClient.getPaginated<RawBarangSerial>(url);
    return {
      data: data.map(mapBarangSerialToUnit),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<BarangSerialUnit> =>
    mapBarangSerialToUnit(await apiClient.get<RawBarangSerial>(`/barang-serial/${id}`)),

  create: async (payload: { barangId: string; gudangId: string; serialNumber: string; catatan?: string }): Promise<BarangSerialUnit> =>
    mapBarangSerialToUnit(
      await apiClient.post<RawBarangSerial>('/barang-serial', {
        barang_id: Number(payload.barangId),
        gudang_id: Number(payload.gudangId),
        serial_number: payload.serialNumber,
        catatan: payload.catatan ?? '',
      }),
    ),

  cariBySerial: async (serialNumber: string): Promise<BarangSerialUnit> =>
    mapBarangSerialToUnit(await apiClient.get<RawBarangSerial>(`/barang-serial/cari/${encodeURIComponent(serialNumber)}`)),

  ringkasan: (barangId: string) =>
    apiClient.get<{ barangId: number; tersedia: number; terpasang: number; rusak: number }>(
      `/barang-serial/ringkasan/${barangId}`,
    ),

  updateStatus: (id: string, status: 'tersedia' | 'terpasang' | 'rusak', catatan?: string) =>
    apiClient.patch<RawBarangSerial>(`/barang-serial/${id}/status`, { status, catatan: catatan ?? '' }),
  // Dipakai modal "Ubah Unit" (pindah gudang + catatan). Sebelumnya
  // BarangSerial.tsx memanggil `.update()` yang tidak ada di sini sama
  // sekali (di-cast paksa lewat `as unknown as {...}` supaya lolos
  // TypeScript) — setiap simpan langsung gagal dengan TypeError yang
  // ketangkep sebagai "Gagal memperbarui unit." Method ini + endpoint
  // PATCH /barang-serial/:id di backend menutup celah itu.
  update: async (id: string, payload: { gudangId: string; catatan?: string }): Promise<BarangSerialUnit> =>
    mapBarangSerialToUnit(
      await apiClient.patch<RawBarangSerial>(`/barang-serial/${id}`, {
        gudang_id: Number(payload.gudangId),
        catatan: payload.catatan ?? '',
      }),
    ),
  remove: (id: string) => apiClient.delete<void>(`/barang-serial/${id}`),
};

export const warehousesApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Warehouse>> => {
    const { data, meta } = await apiClient.getPaginated<RawGudang>(
      `/gudang${buildQuery(params)}`,
    );
    return {
      data: data.map((raw): Warehouse => {
        return {
          id: String(raw.id),
          name: raw.nama,
          code: raw.kode || '-',
          address: raw.alamat ?? '-',
          capacity: raw.kapasitas ?? 0,

          usedCapacity: raw.unitTersedia ?? 0,
          totalItems: raw.skuTersedia ?? 0,
          picName: raw.pic || '-',
          phone: raw.telepon || undefined,
          status: 'aktif',
          latitude: raw.latitude ?? undefined,
          longitude: raw.longitude ?? undefined,
          isProtected: raw.isProtected ?? false,
        };
      }),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: (id: string) => apiClient.get<RawGudang>(`/gudang/${id}`),
  create: (payload: Partial<Warehouse>) =>
    apiClient.post<RawGudang>('/gudang', {
      nama: payload.name,
      kode: payload.code,
      alamat: payload.address,
      pic: payload.picName,
      telepon: payload.phone,
      kapasitas: payload.capacity,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
    }),
  update: (id: string, payload: Partial<Warehouse>) =>
    apiClient.put<RawGudang>(`/gudang/${id}`, {
      nama: payload.name,
      kode: payload.code,
      alamat: payload.address,
      pic: payload.picName,
      telepon: payload.phone,
      kapasitas: payload.capacity,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
    }),
  remove: (id: string) => apiClient.delete<void>(`/gudang/${id}`),

  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawGudang>(`/gudang/${id}/protect`, { is_protected: isProtected }),
};

export interface GoodsItemPayload {
  barang_id: number;
  qty: number;
  harga_satuan?: number;
}

export interface GoodsInPayload {
  purchase_order_id?: number;
  supplier_id?: number;
  gudang_id: number;
  tanggal: string;
  catatan?: string;
  items: GoodsItemPayload[];
}

const goodsInResource = createResourceApi<RawBarangMasuk, GoodsInPayload>('/barang-masuk');

export const goodsInApi = {
  list: goodsInResource.list,
  getById: goodsInResource.getById,
  create: goodsInResource.create,
  update: (id: string, payload: GoodsInPayload) => goodsInResource.update(id, payload),
  remove: goodsInResource.remove,

  complete: (id: string, serialsByItemId?: Record<string, string[]>) =>
    apiClient.patch<RawBarangMasuk>(`/barang-masuk/${id}/selesai`, {
      items: Object.entries(serialsByItemId ?? {}).map(([barangMasukItemId, serialNumbers]) => ({
        barang_masuk_item_id: Number(barangMasukItemId),
        serial_numbers: serialNumbers,
      })),
    }),

  cancel: (id: string) => apiClient.patch<RawBarangMasuk>(`/barang-masuk/${id}/batalkan`, {}),

  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawBarangMasuk>(`/barang-masuk/${id}/protect`, { is_protected: isProtected }),
};

export interface GoodsOutPayload {
  gudang_id: number;
  tanggal: string;
  keperluan: string;
  penerima?: string;
  items: GoodsItemPayload[];
}

const goodsOutResource = createResourceApi<RawBarangKeluar, GoodsOutPayload>('/barang-keluar');

export const goodsOutApi = {
  list: goodsOutResource.list,
  getById: goodsOutResource.getById,
  create: goodsOutResource.create,
  update: (id: string, payload: GoodsOutPayload) => goodsOutResource.update(id, payload),
  remove: goodsOutResource.remove,

  complete: (id: string, serialsByItemId?: Record<string, string[]>) =>
    apiClient.patch<RawBarangKeluar>(`/barang-keluar/${id}/selesai`, {
      items: Object.entries(serialsByItemId ?? {}).map(([barangKeluarItemId, serialNumbers]) => ({
        barang_keluar_item_id: Number(barangKeluarItemId),
        serial_numbers: serialNumbers,
      })),
    }),

  cancel: (id: string) => apiClient.patch<RawBarangKeluar>(`/barang-keluar/${id}/batalkan`, {}),

  // Spesifikasi pemasangan: dari Qty yang dikeluarkan pada 1 item, berapa
  // yang sudah terpasang di lapangan — sisanya dihitung otomatis oleh backend.
  updateSpesifikasi: (id: string, itemId: string, payload: { jumlahTerpasang: number; catatan?: string }) =>
    apiClient.patch<RawBarangKeluarItem>(`/barang-keluar/${id}/items/${itemId}/spesifikasi`, payload),

  recapSpesifikasi: (params?: { gudangId?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.gudangId) query.set('gudang_id', params.gudangId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    const suffix = qs ? `?${qs}` : '';
    return apiClient.get<RawSpesifikasiRecapRow[]>(`/barang-keluar/spesifikasi/recap${suffix}`);
  },

  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawBarangKeluar>(`/barang-keluar/${id}/protect`, { is_protected: isProtected }),
};

// spesifikasiApi: daftar baris spesifikasi per-item (bukan rekap agregat) —
// dipakai tab "Spesifikasi" di halaman Kelola Barang, gaya sama seperti
// barangSerialApi.list (filter barang/gudang/status + paginasi server-side).
export const spesifikasiApi = {
  list: async (
    params?: ListParams & { barangId?: string; gudangId?: string; status?: string },
  ): Promise<PaginatedResult<RawSpesifikasiListRow>> => {
    const { barangId, gudangId, status, ...listParams } = params ?? {};
    const query = buildQuery(listParams);
    const extra = [
      barangId ? `barang_id=${barangId}` : '',
      gudangId ? `gudang_id=${gudangId}` : '',
      status ? `status=${status}` : '',
    ].filter(Boolean).join('&');
    const separator = query ? '&' : '?';
    const url = extra ? `/barang-keluar/spesifikasi${query}${separator}${extra}` : `/barang-keluar/spesifikasi${query}`;
    const { data, meta } = await apiClient.getPaginated<RawSpesifikasiListRow>(url);
    return {
      data,
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
};

export interface PengajuanPayload {
  jenis?: 'masuk' | 'keluar' | 'rusak' | 'template';
  gudangId: number;
  tanggal: string;
  keperluan: string;
  perihal?: string;
  // templateId: wajib diisi hanya untuk jenis "template" — merujuk ke
  // formulir yang dipilih dari pengajuanTemplatesApi.list().
  templateId?: number;
  namaPencatat?: string;
  jabatanPencatat?: string;
  items: GoodsItemPayload[];
}

export interface PengajuanProsesPayload {
  namaGa?: string;
  jabatanGa?: string;
  catatan?: string;
}

const pengajuanResource = createResourceApi<RawPengajuanBarang, PengajuanPayload>('/pengajuan-barang');

export const pengajuanApi = {
  list: pengajuanResource.list,
  getById: pengajuanResource.getById,
  create: pengajuanResource.create,
  update: (id: string, payload: PengajuanPayload) => pengajuanResource.update(id, payload),
  remove: pengajuanResource.remove,

  summary: () =>
    apiClient.get<{ totalDiajukan: number; totalDisetujui: number; totalDitolak: number }>(
      '/pengajuan-barang/summary',
    ),

  setujui: (id: string, payload?: PengajuanProsesPayload) =>
    apiClient.patch<RawPengajuanBarang>(`/pengajuan-barang/${id}/setujui`, payload ?? {}),

  tolak: (id: string, payload: PengajuanProsesPayload & { catatan: string }) =>
    apiClient.patch<RawPengajuanBarang>(`/pengajuan-barang/${id}/tolak`, payload),
};

// pengajuanTemplatesApi: formulir kosong (docx/pdf) yang diunggah admin,
// dipilih lewat dropdown "Template Formulir" di menu Pengajuan Barang saat
// membuat pengajuan jenis "template" — menggantikan "Pengajuan ke Atasan"
// (jenis "umum") yang lama. "Cetak" untuk jenis ini mengunduh berkas asli
// formulirnya (lihat `download`), bukan dokumen hasil generate sistem.
export const pengajuanTemplatesApi = {
  list: async (
    params?: { page?: number; pageSize?: number; search?: string; onlyActive?: boolean },
  ): Promise<PaginatedResult<RawPengajuanTemplate>> => {
    const { onlyActive, ...rest } = params ?? {};
    const query = buildQuery({ ...rest, ...(onlyActive ? { only_active: 'true' } : {}) });
    const { data, meta } = await apiClient.getPaginated<RawPengajuanTemplate>(`/pengajuan-templates${query}`);
    return {
      data,
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },

  upload: (payload: { nama: string; deskripsi?: string; file: File }) =>
    uploadFile<RawPengajuanTemplate>('/pengajuan-templates', payload.file, 'file', {
      nama: payload.nama,
      ...(payload.deskripsi ? { deskripsi: payload.deskripsi } : {}),
    }),

  remove: (id: string) => apiClient.delete<null>(`/pengajuan-templates/${id}`),

  download: (template: Pick<RawPengajuanTemplate, 'fileUrl' | 'fileName'>) =>
    downloadFile(template.fileUrl, template.fileName),
};

export interface StockOpnameItemPayload {
  barangId: number;
  stokFisik: number;
  catatan?: string;
}

export interface StockOpnamePayload {
  gudangId: number;
  tanggal: string;
  catatan?: string;
  items: StockOpnameItemPayload[];
}

export const inventoryApi = {

  ringkasanStok: async (): Promise<PaginatedResult<StokGudangRecord>> => {
    const raw = await apiClient.get<RawRingkasanStokRow[]>('/barang/ringkasan-stok');
    const mapped = raw.map(mapRingkasanStokRow);
    return { data: mapped, page: 1, pageSize: mapped.length, total: mapped.length };
  },
  listSessions: async (params?: ListParams): Promise<PaginatedResult<RawStockOpname>> => {
    const { data, meta } = await apiClient.getPaginated<RawStockOpname>(
      `/stock-opname${buildQuery(params)}`,
    );
    return {
      data,
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: (id: string) => apiClient.get<RawStockOpname>(`/stock-opname/${id}`),
  create: (payload: StockOpnamePayload) => apiClient.post<RawStockOpname>('/stock-opname', payload),
  update: (id: string, payload: StockOpnamePayload) =>
    apiClient.put<RawStockOpname>(`/stock-opname/${id}`, payload),
  remove: (id: string) => apiClient.delete<void>(`/stock-opname/${id}`),

  complete: (id: string) => apiClient.patch<RawStockOpname>(`/stock-opname/${id}/selesai`),

  cancel: (id: string) => apiClient.patch<RawStockOpname>(`/stock-opname/${id}/batalkan`),
  batalkan: (id: string) => apiClient.patch<RawStockOpname>(`/stock-opname/${id}/batalkan`),
};

export interface AssetPayload {
  nama: string;
  jenisAset: JenisAset;
  gudangId: number;
  latitude?: number | null;
  longitude?: number | null;
  keterangan?: string;
  merek?: string;
  tipe?: string;

  nilaiAset?: number;

  parentAssetId?: number | null;

  jumlahPort?: number;

  barangId?: number | null;

  // Khusus jenisAset === 'transportasi'
  nopol?: string;
  jenisTransportasi?: string;
  nomorBpkb?: string;
  tahunKendaraan?: number;
}

export interface AssetMapPoint {
  id: number;
  nama: string;
  jenisAset: JenisAset;
  labelRsd: string;
  latitude: number;
  longitude: number;
  status: 'aktif' | 'rusak' | 'nonaktif';
  gudangId: number;
  gudangNama: string;
  gudangKode: string;

  gudangTipe: 'pusat' | 'cabang';

  gudangLatitude?: number | null;
  gudangLongitude?: number | null;

  parentAssetId?: number | null;
  parentLatitude?: number | null;
  parentLongitude?: number | null;
  jumlahPort?: number;
  portTerisi?: number;

  merek?: string;
  tipe?: string;
  kodeBarang?: string;
}

export const assetsApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Asset>> => {
    const { data, meta } = await apiClient.getPaginated<RawAsset>(`/aset${buildQuery(params)}`);
    return {
      data: data.map(mapAssetRaw),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<Asset> => mapAssetRaw(await apiClient.get<RawAsset>(`/aset/${id}`)),
  summary: () =>
    apiClient.get<{ tiang: number; odc: number; ont: number; odp: number; olt: number; transportasi: number; total: number }>(
      '/aset/summary',
    ),
  create: (payload: AssetPayload) => apiClient.post<RawAsset>('/aset', payload),
  update: (id: string, payload: AssetPayload) => apiClient.put<RawAsset>(`/aset/${id}`, payload),

  setStatus: (id: string, status: 'aktif' | 'rusak' | 'nonaktif') =>
    apiClient.patch<RawAsset>(`/aset/${id}/status`, { status }),

  map: (params?: { jenisAset?: JenisAset; gudangId?: number; tipeGudang?: 'pusat' | 'cabang'; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.jenisAset) q.set('jenis_aset', params.jenisAset);
    if (params?.gudangId) q.set('gudang_id', String(params.gudangId));
    if (params?.tipeGudang) q.set('tipe_gudang', params.tipeGudang);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    const url = qs ? `/aset/map?${qs}` : '/aset/map';
    return apiClient.get<AssetMapPoint[]>(url);
  },
  remove: (id: string) => apiClient.delete<void>(`/aset/${id}`),
};

export interface AssetHistoryEntry {
  id: number;
  eventType: 'dibuat' | 'status' | 'lokasi' | 'induk' | 'gudang' | 'port' | 'nilai_aset' | 'data_transportasi';
  fieldLama?: string;
  fieldBaru?: string;
  catatan?: string;
  userNama?: string;
  createdAt: string;
}

export const assetHistoryApi = {
  list: (assetId: string) => apiClient.get<AssetHistoryEntry[]>(`/aset/${assetId}/riwayat`),
  // listByBulan: fitur tracking Bulanan — ambil SEMUA kejadian riwayat aset
  // ini dalam 1 bulan (format "2026-08"), bukan cuma 100 kejadian terakhir.
  listByBulan: (assetId: string, bulan: string) =>
    apiClient.get<AssetHistoryEntry[]>(`/aset/${assetId}/riwayat?bulan=${bulan}`),
};

export interface AssetPortItem {
  portNumber: number;
  status: 'kosong' | 'terisi';
  childAssetId?: number;
  childAssetNama?: string;
  childAssetLabel?: string;
  customerName?: string;
  customerPhone?: string;
  keterangan?: string;
}

export const assetPortApi = {
  list: (assetId: string) => apiClient.get<AssetPortItem[]>(`/aset/${assetId}/port`),

  set: (
    assetId: string,
    portNumber: number,
    payload: { childAssetId?: number | null; customerName?: string; customerPhone?: string; keterangan?: string },
  ) => apiClient.put<AssetPortItem[]>(`/aset/${assetId}/port/${portNumber}`, payload),
  clear: (assetId: string, portNumber: number) => apiClient.delete<null>(`/aset/${assetId}/port/${portNumber}`),
};

export interface BarangRusakPayload {
  barangId?: number | null;
  labelBarang: string;
  namaBarang: string;
  merek?: string;
  kodeBarang?: string;

  serialNumber?: string;
  keterangan?: string;
}

export const barangRusakApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<BarangRusak>> => {
    const { data, meta } = await apiClient.getPaginated<RawBarangRusak>(`/barang-rusak${buildQuery(params)}`);
    return {
      data: data.map(mapBarangRusakRaw),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<BarangRusak> =>
    mapBarangRusakRaw(await apiClient.get<RawBarangRusak>(`/barang-rusak/${id}`)),
  summary: () =>
    apiClient.get<{ pengecekan: number; retur: number; rusak: number; total: number }>('/barang-rusak/summary'),
  create: (payload: BarangRusakPayload) => apiClient.post<RawBarangRusak>('/barang-rusak', payload),
  update: (id: string, payload: BarangRusakPayload) => apiClient.put<RawBarangRusak>(`/barang-rusak/${id}`, payload),

  inspeksi: (id: string, jenisBarang: 'retur' | 'rusak') =>
    apiClient.patch<RawBarangRusak>(`/barang-rusak/${id}/inspeksi`, { jenis_barang: jenisBarang }),

  // Pengganti fitur retur-ke-supplier yang sudah dihapus — simpan kembali
  // barang berstatus "Bisa Diretur" (bukan Rusak Total) sebagai stok ke
  // gudang yang dipilih.
  simpanKeGudang: (id: string, gudangId: string) =>
    apiClient.patch<RawBarangRusak>(`/barang-rusak/${id}/simpan-gudang`, { gudang_id: Number(gudangId) }),

  uploadFoto: (id: string, file: File) =>
    uploadFile<RawBarangRusak>(`/barang-rusak/${id}/foto`, file, 'foto'),
  remove: (id: string) => apiClient.delete<void>(`/barang-rusak/${id}`),
};

export interface ManagedUserPayload {
  name: string;
  username: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;

  password?: string;
}

let cachedRoleIds: Record<string, number> | null = null;

async function resolveRoleId(roleName: string): Promise<number> {
  if (!cachedRoleIds) {
    const roles = await rolesApi.list();
    cachedRoleIds = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  }
  const id = cachedRoleIds[roleName];
  if (!id) {

    const roles = await rolesApi.list();
    cachedRoleIds = Object.fromEntries(roles.map((r) => [r.name, r.id]));
    return cachedRoleIds[roleName] ?? 0;
  }
  return id;
}

export const usersApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<ManagedUser>> => {
    const { data, meta } = await apiClient.getPaginated<RawUser>(`/users${buildQuery(params)}`);
    return {
      data: data.map(mapUserRaw),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<ManagedUser> => mapUserRaw(await apiClient.get<RawUser>(`/users/${id}`)),
  create: async (payload: ManagedUserPayload): Promise<ManagedUser> => {
    const roleId = await resolveRoleId(payload.role);
    const raw = await apiClient.post<RawUser>('/users', {
      username: payload.username,
      email: payload.email,
      password: payload.password,
      fullName: payload.name,
      phoneNumber: payload.phoneNumber,
      roleId,
    });
    return mapUserRaw(raw);
  },
  update: async (id: string, payload: Partial<ManagedUserPayload>): Promise<ManagedUser> => {
    const roleId = payload.role ? await resolveRoleId(payload.role) : undefined;
    const raw = await apiClient.put<RawUser>(`/users/${id}`, {
      email: payload.email,
      fullName: payload.name,
      phoneNumber: payload.phoneNumber,
      roleId,
    });
    return mapUserRaw(raw);
  },
  remove: (id: string) => apiClient.delete<void>(`/users/${id}`),

  listSessions: async (id: string): Promise<UserDeviceSession[]> => {
    const res = await apiClient.get<{ sessions: RawUserSession[] }>(`/users/${id}/sessions`);
    return res.sessions.map(mapUserSessionRaw);
  },

  revokeSession: (id: string, sessionId: string) =>
    apiClient.delete<void>(`/users/${id}/sessions/${sessionId}`),
};

export interface MaintenanceStatus {
  isActive: boolean;
  message?: string;
  startedAt?: string;
  estimatedUntil?: string;
  remainingSeconds?: number;
}

export const maintenanceApi = {
  status: () => apiClient.get<MaintenanceStatus>('/maintenance/status'),
  set: (payload: { isActive: boolean; message?: string; estimatedUntil?: string | null }) =>
    apiClient.put<MaintenanceStatus>('/maintenance', payload),
};

export interface KategoriRaw {
  id: number;
  nama: string;
}

export const kategoriApi = {
  list: async (): Promise<KategoriRaw[]> => {
    const { data } = await apiClient.getPaginated<KategoriRaw>('/gudang/kategori?limit=100');
    return data;
  },
  create: async (nama: string): Promise<KategoriRaw> => apiClient.post<KategoriRaw>('/gudang/kategori', { nama }),
};

export interface SatuanRaw {
  id: number;
  nama: string;
  singkatan: string;
}

export const satuanApi = {
  list: async (): Promise<SatuanRaw[]> => {
    const { data } = await apiClient.getPaginated<SatuanRaw>('/gudang/satuan?limit=100');
    return data;
  },
  create: async (nama: string, singkatan: string): Promise<SatuanRaw> =>
    apiClient.post<SatuanRaw>('/gudang/satuan', { nama, singkatan }),
};

export interface PermissionMatrixItem {
  module: string;
  view: boolean;
  tambah: boolean;
  edit: boolean;
  approvalReject: boolean;
  print: boolean;
  assignDelegasi: boolean;
}

export const rolesApi = {
  list: () => apiClient.get<Array<{ id: number; name: string }>>('/roles'),
  getPermissionMatrix: (id: number) =>
    apiClient.get<{ roleId: number; items: PermissionMatrixItem[] }>(`/roles/${id}/permissions`),
  updatePermissionMatrix: (id: number, items: PermissionMatrixItem[]) =>
    apiClient.put<null>(`/roles/${id}/permissions`, { items }),
};

export interface DashboardSummaryRaw {
  kelolaBarang: { totalBarang: number; stokMenipis: number; totalNilaiInventaris: number };
  gudang: { totalGudang: number };
  barangMasuk: { draft: number; selesai: number };
  barangKeluar: { draft: number; selesai: number };
  stockOpname: { draft: number; selesai: number };
}

export interface DashboardTrendPointRaw {
  bulan: string;
  masuk: number;
  keluar: number;
}

export interface AnalisaRaw {
  totalSku: number;
  totalRestockBulanIni: number;
  stokMenipis: number;
  kategoriComposition: Array<{ label: string; value: number }>;
  topRestocked: Array<{ name: string; value: number }>;
  topKeluar: Array<{ name: string; value: number }>;
  totalAset: number;
  asetRusak: number;
  asetPerJenis: Array<{ label: string; value: number }>;
  asetPerStatus: Array<{ label: string; value: number }>;
  asetPerGudang: Array<{ label: string; value: number }>;
}

export interface LaporanChartData {
  title: string;
  type: 'bar' | 'line';
  labels: string[];
  values: number[];
}

export interface LaporanPreview {
  title: string;
  headers: string[];
  rows: string[][];
  summary: Array<{ label: string; value: string }>;
  chart?: LaporanChartData | null;
  granularitas?: 'harian' | 'bulanan' | 'tahunan';
}

export interface AppVersionInfo {
  version: string;
  appName: string;
  description?: string;
  developer?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    new?: string[];
    fix?: string[];
  };
}

export interface CheckUpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;

  selfUpdateEnabled: boolean;
}

export type SelfUpdateState = 'idle' | 'running' | 'success' | 'failed';

export interface SelfUpdateStatus {
  state: SelfUpdateState;
  message: string;
  fromVersion?: string;
  toVersion?: string;
  startedAt?: string;
  finishedAt?: string;
  maintenanceAuto: boolean;
  acknowledged: boolean;
}

export const appInfoApi = {
  version: () => apiClient.get<AppVersionInfo>('/app/version'),
  changelog: () => apiClient.get<ChangelogEntry[]>('/app/changelog'),

  checkUpdate: () => apiClient.get<CheckUpdateInfo>('/app/check-update'),

  updateStatus: () => apiClient.get<SelfUpdateStatus>('/app/update-status'),

  triggerUpdate: () => apiClient.post<SelfUpdateStatus>('/app/update', {}),
};

// Precision hasil geocoding — dikirim balik backend supaya frontend bisa
// kasih tahu pengguna dengan jujur seberapa dekat titik yang ditemukan:
// 'street' = level jalan/nomor rumah (paling akurat), 'area' = level
// kelurahan/desa/kecamatan, 'region' = cuma level kabupaten/kota/provinsi
// (sebaiknya digeser manual di peta), 'unknown' = tidak diketahui.
export type GeocodePrecision = 'street' | 'area' | 'region' | 'unknown';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  precision: GeocodePrecision;
}

interface RawGeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
  precision: GeocodePrecision;
}

// geocodeApi: proxy ke Nominatim/OpenStreetMap lewat backend (bukan
// dipanggil langsung dari browser) — backend yang menegakkan User-Agent
// yang benar, rate limit, caching, dan parsing alamat gaya Indonesia
// (notasi RT/RW) sebelum query ke Nominatim. Lihat pkg/geocoding di
// backend untuk detailnya.
export const geocodeApi = {
  search: async (address: string, signal?: AbortSignal): Promise<GeocodeResult> => {
    const raw = await apiClient.get<RawGeocodeResult>(
      `/geocode?address=${encodeURIComponent(address)}`,
      { signal },
    );
    return {
      latitude: raw.latitude,
      longitude: raw.longitude,
      displayName: raw.display_name,
      precision: raw.precision,
    };
  },
};

export interface LaporanCustomExportPayload {
  tipe: string;
  judul: string;
  format: 'Excel' | 'PDF' | 'Docs';
  headers: string[];
  rows: string[][];
}

export const laporanApi = {

  preview: (tipe: string, dari?: string, sampai?: string, granularitas?: 'harian' | 'bulanan' | 'tahunan') => {
    const params = new URLSearchParams({ tipe });
    if (dari) params.set('dari', dari);
    if (sampai) params.set('sampai', sampai);
    if (granularitas) params.set('granularitas', granularitas);
    return apiClient.get<LaporanPreview>(`/laporan/preview?${params.toString()}`);
  },

  exportCustom: (payload: LaporanCustomExportPayload, filename?: string) =>
    downloadFileWithBody('/laporan/export-custom', payload, filename),
};

export const dashboardApi = {

  summary: () => apiClient.get<DashboardSummaryRaw>('/dashboard/summary'),

  trend: () => apiClient.get<DashboardTrendPointRaw[]>('/dashboard/trend'),

  activity: async (): Promise<ActivityItem[]> => {
    const raw = await apiClient.get<
      Array<{ id: string; user: string; act: string; time: string; type: string }>
    >('/dashboard/activity');
    return raw.map((item) => ({
      id: item.id,
      message: `${item.user} ${item.act}`,
      timeAgo: item.time,
    }));
  },

  analisa: () => apiClient.get<AnalisaRaw>('/dashboard/analisa'),
};

function buildQuery(params: ListParams = {}): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    const queryKey = key === 'pageSize' ? 'limit' : key;
    searchParams.set(queryKey, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export type { UserRole };

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message?: string;
  linkHref?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<AppNotification>> => {
    const { data, meta } = await apiClient.getPaginated<AppNotification>(`/notifications${buildQuery(params)}`);
    return {
      data,
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  unreadCount: () => apiClient.get<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (id: number) => apiClient.patch<null>(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch<null>('/notifications/read-all'),

  remove: (id: number) => apiClient.delete<null>(`/notifications/${id}`),
};

export interface TrashItem {
  type: 'aset' | 'barang' | 'gudang' | 'barang_rusak';
  id: number;
  judul: string;
  subjudul?: string;
  deletedAt: string;
}

export const trashApi = {
  list: (type?: TrashItem['type']) => {
    const query = type ? `?type=${type}` : '';
    return apiClient.get<TrashItem[]>(`/trash${query}`);
  },
  restore: (type: TrashItem['type'], id: number) =>
    apiClient.post<null>(`/trash/${type}/${id}/restore`),
  purge: (type: TrashItem['type'], id: number) => apiClient.delete<null>(`/trash/${type}/${id}`),
};

export interface DeliveryPayload {
  gudangAsalId: number;
  jenisPengambilan: 'pickup' | 'dropoff';
  namaPenerima: string;
  teleponPenerima?: string;
  alamatTujuan: string;
  destLat?: number | null;
  destLng?: number | null;
  tanggalKirim: string;
  catatan?: string;
}

export interface DeliveryTrackResult {
  lat: number | null;
  lng: number | null;
  recordedAt: string | null;
}

export const deliveriesApi = {
  ...createResourceApi<Delivery, DeliveryPayload>('/pengiriman'),

  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<Delivery>(`/pengiriman/${id}/protect`, { is_protected: isProtected }),

  jadwalkan: (id: string, payload: { namaKurir: string; teleponKurir?: string }) =>
    apiClient.patch<Delivery>(`/pengiriman/${id}/jadwalkan`, payload),

  mulai: (id: string) => apiClient.patch<Delivery>(`/pengiriman/${id}/mulai`, {}),

  complete: (id: string) => apiClient.patch<Delivery>(`/pengiriman/${id}/complete`, {}),

  track: (id: string) => apiClient.get<DeliveryTrackResult>(`/pengiriman/${id}/track`),

  sendLocation: (id: string, payload: { lat: number; lng: number; kecepatanKmh?: number }) =>
    apiClient.post<null>(`/pengiriman/${id}/lokasi`, payload),
};
function downloadFileWithBody(arg0: string, payload: LaporanCustomExportPayload, filename: string | undefined) {
  throw new Error('Function not implemented.');
}

