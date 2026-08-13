import { apiClient } from '@/lib/api/client';
import { createResourceApi } from '@/lib/api/resource';
import { mapAssetRaw, mapBarangRusakRaw, mapBarangToItem, mapItemToBarangPayload, mapStockOpnameToRecords, mapSupplierRaw, mapUserRaw } from '@/lib/api/mappers';
import type {
  RawAsset,
  RawBarang,
  RawBarangKeluar,
  RawBarangMasuk,
  RawBarangRusak,
  RawGudang,
  RawPengiriman,
  RawPurchaseOrder,
  RawStockOpname,
  RawSupplier,
  RawUser,
} from '@/lib/api/raw-types';
import type {
  Asset,
  BarangRusak,
  Delivery,
  InventoryRecord,
  Item,
  JenisAset,
  ManagedUser,
  PaginatedResult,
  PurchaseOrder,
  Supplier,
  UserRole,
  Warehouse,
} from '@/types';
import type { ListParams } from '@/lib/api/resource';
import type { ActivityItem } from '@/component/roles_dashboard/RecentActivityCard';

/**
 * ====================================================================
 * PETA ENDPOINT NYATA BACKEND GOSTOK (internal/routes/router.go)
 * ====================================================================
 * Base URL: NEXT_PUBLIC_API_BASE_URL (default http://localhost:8080/stockrsd)
 *
 *   /barang            Kelola Barang         (bukan /items)
 *   /gudang            Kelola Gudang & Rak   (bukan /warehouses)
 *   /supplier          Supplier              (bukan /suppliers)
 *   /purchase-order    Purchase Order        (bukan /purchase-orders)
 *   /barang-masuk      Barang Masuk (goods-in)
 *   /barang-keluar     Barang Keluar (goods-out)
 *   /stock-opname      Stok Opname / Inventaris (bukan /inventory)
 *   /pengiriman        Pengiriman            (bukan /deliveries)
 *   /aset              Manajemen Aset Gudang (tiang/odc/ont/odp/olt/transportasi)
 *   /barang-rusak      Barang Rusak (retur/rusak)
 *   /users             Manajemen User        (sudah benar)
 *   /roles             Role & Permission Matrix
 *   /dashboard/summary + /dashboard/trend + /dashboard/activity + ...
 * ====================================================================
 */

// ---------------------------------------------------------------------------
// Barang (Kelola Barang) — dipetakan penuh dari bahasa Indonesia ke tipe UI.
// ---------------------------------------------------------------------------
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
  /** PATCH /barang/:id/protect — khusus super_admin. */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawBarang>(`/barang/${id}/protect`, { is_protected: isProtected }),
  /** PATCH /barang/:id/approve — khusus super_admin, setujui pengajuan admin. */
  approve: (id: string) => apiClient.patch<RawBarang>(`/barang/${id}/approve`, {}),
  /** PATCH /barang/:id/reject — khusus super_admin, tolak pengajuan admin + catatan alasan. */
  reject: (id: string, catatan: string) =>
    apiClient.patch<RawBarang>(`/barang/${id}/reject`, { catatan }),
  /** GET /barang/summary -> { total_barang, stok_menipis, total_nilai_inventaris } */
  summary: () =>
    apiClient.get<{ totalBarang: number; stokMenipis: number; totalNilaiInventaris: number }>(
      '/barang/summary',
    ),
};

// ---------------------------------------------------------------------------
// Supplier — dipetakan penuh.
// ---------------------------------------------------------------------------
export const suppliersApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Supplier>> => {
    const { data, meta } = await apiClient.getPaginated<RawSupplier>(
      `/supplier${buildQuery(params)}`,
    );
    return {
      data: data.map(mapSupplierRaw),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<Supplier> =>
    mapSupplierRaw(await apiClient.get<RawSupplier>(`/supplier/${id}`)),
  create: (payload: Partial<Supplier>) =>
    apiClient.post<RawSupplier>('/supplier', {
      kode: payload.code || payload.name?.slice(0, 8).toUpperCase(),
      nama: payload.name,
      pic: payload.contactPerson,
      telepon: payload.phone,
      kerjasama_kurir: (payload.courierPartners ?? []).join(','),
      alamat: payload.address,
      npwp: payload.npwp,
      catatan: payload.notes,
    }),
  update: (id: string, payload: Partial<Supplier>) =>
    apiClient.put<RawSupplier>(`/supplier/${id}`, {
      kode: payload.code,
      nama: payload.name,
      pic: payload.contactPerson,
      telepon: payload.phone,
      kerjasama_kurir: (payload.courierPartners ?? []).join(','),
      alamat: payload.address,
      npwp: payload.npwp,
      catatan: payload.notes,
    }),
  remove: (id: string) => apiClient.delete<void>(`/supplier/${id}`),
  /** PATCH /supplier/:id/protect — khusus super_admin. */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawSupplier>(`/supplier/${id}/protect`, { is_protected: isProtected }),
};

// ---------------------------------------------------------------------------
// Gudang (Warehouse) — usedCapacity & totalItems dihitung otomatis dari
// SUM(Rak.Terisi) tiap gudang (lihat catatan panjang di RawGudang.raks,
// raw-types.ts) — TANPA sensor IoT, murni dari angka yang sudah disesuaikan
// otomatis oleh backend setiap dokumen Barang Masuk/Keluar/Stock Opname
// diselesaikan. Hanya akurat untuk item yang di-assign ke rak spesifik saat
// input dokumen; item tanpa rak_id tidak ikut terhitung di sini.
// ---------------------------------------------------------------------------
export const warehousesApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Warehouse>> => {
    const { data, meta } = await apiClient.getPaginated<RawGudang>(
      `/gudang${buildQuery(params)}`,
    );
    return {
      data: data.map((raw): Warehouse => {
        const raks = raw.raks ?? [];
        const usedFromRaks = raks.reduce((sum, r) => sum + (r.terisi ?? 0), 0);
        return {
          id: String(raw.id),
          name: raw.nama,
          code: raw.kode || '-',
          address: raw.alamat ?? '-',
          capacity: raw.kapasitas ?? 0,
          usedCapacity: usedFromRaks,
          totalItems: usedFromRaks,
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
  /** PATCH /gudang/:id/protect — khusus super_admin. */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawGudang>(`/gudang/${id}/protect`, { is_protected: isProtected }),
};

// ---------------------------------------------------------------------------
// Purchase Order — status backend (draft/diajukan/disetujui/ditolak/
// dibatalkan) BEDA kosakata dari status UI lama (draft/diproses/dikirim/
// selesai/dibatalkan). Dipetakan ke status UI terdekat; sesuaikan lagi
// kalau mau istilah asli backend yang tampil ke pengguna.
// ---------------------------------------------------------------------------
// PENTING: value di sini HARUS PERSIS sama dengan string yang backend
// simpan (lihat pkg/constant/cons_po.go — berkapital "Draft"/"Diajukan"/
// "Disetujui"/"Ditolak"/"Dibatalkan"). Sama seperti bug DELIVERY_STATUS_MAP
// di bawah — key huruf kecil sebelumnya bikin status selain "Draft" gagal
// ke-lookup dan diam-diam jatuh ke fallback 'draft'.
const PO_STATUS_MAP: Record<RawPurchaseOrder['status'], PurchaseOrder['status']> = {
  Draft: 'draft',
  Diajukan: 'diproses',
  Disetujui: 'dikirim',
  Ditolak: 'dibatalkan',
  Dibatalkan: 'dibatalkan',
};

export interface PurchaseOrderItemPayload {
  barangId: number;
  qtyPesan: number;
  hargaSatuan: number;
}

export interface PurchaseOrderPayload {
  supplierId: number;
  tanggalPo: string; // YYYY-MM-DD
  catatanPengajuan?: string;
  items: PurchaseOrderItemPayload[];
}

export const purchaseOrdersApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<PurchaseOrder>> => {
    const { data, meta } = await apiClient.getPaginated<RawPurchaseOrder>(
      `/purchase-order${buildQuery(params)}`,
    );
    return {
      data: data.map(
        (raw): PurchaseOrder => ({
          id: String(raw.id),
          orderNumber: raw.nomorPo,
          supplierId: String(raw.supplierId),
          supplierName: raw.supplier?.nama ?? '-',
          itemCount: raw.items?.length ?? 0,
          totalAmount: raw.totalEstimasi,
          orderDate: raw.tanggalPo,
          expectedDate: raw.tanggalPo,
          status: PO_STATUS_MAP[raw.status] ?? 'draft',
          rawStatus: raw.status,
          isProtected: raw.isProtected ?? false,
        }),
      ),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: (id: string) => apiClient.get<RawPurchaseOrder>(`/purchase-order/${id}`),
  create: (payload: PurchaseOrderPayload) => apiClient.post<RawPurchaseOrder>('/purchase-order', payload),
  update: (id: string, payload: PurchaseOrderPayload) =>
    apiClient.put<RawPurchaseOrder>(`/purchase-order/${id}`, payload),
  remove: (id: string) => apiClient.delete<void>(`/purchase-order/${id}`),
  /** PATCH /purchase-order/:id/ajukan — draft -> diajukan (menunggu approval). */
  ajukan: (id: string) => apiClient.patch<RawPurchaseOrder>(`/purchase-order/${id}/ajukan`),
  /** PATCH /purchase-order/:id/approval — khusus role dengan izin `approval_reject`. */
  approve: (id: string, catatan?: string) =>
    apiClient.patch<RawPurchaseOrder>(`/purchase-order/${id}/approval`, { setuju: true, catatan }),
  reject: (id: string, catatan?: string) =>
    apiClient.patch<RawPurchaseOrder>(`/purchase-order/${id}/approval`, { setuju: false, catatan }),
  batalkan: (id: string) => apiClient.patch<RawPurchaseOrder>(`/purchase-order/${id}/batalkan`),
  /** PATCH /purchase-order/:id/protect — khusus super_admin. */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawPurchaseOrder>(`/purchase-order/${id}/protect`, { is_protected: isProtected }),
};

// ---------------------------------------------------------------------------
// Pengiriman (Delivery) — status backend (draft/terjadwal/dikirim/terkirim/
// dibatalkan) dipetakan ke DeliveryStatus UI (menunggu/dijemput/perjalanan/
// terkirim/gagal); "gagal" tidak punya padanan asli di backend saat ini.
// ---------------------------------------------------------------------------
// PENTING: value di sini HARUS PERSIS sama dengan string yang backend
// simpan (lihat pkg/constant/const_pengiriman.go — StatusPGDraft dkk
// SENGAJA berkapital, "Draft"/"Dijadwalkan"/"Dalam Perjalanan", BUKAN
// "draft"/"terjadwal"/"dikirim" huruf kecil seperti sebelumnya di sini).
// Bug sebelumnya: key salah huruf besar/kecil membuat SEMUA status selain
// "Draft" gagal ke-lookup dan diam-diam jatuh ke fallback 'menunggu' —
// makanya status "Dalam Perjalanan" tidak pernah terbaca benar sama
// sekali (termasuk bikin ping GPS kelihatan tidak berfungsi, padahal
// pengirimannya memang belum pernah benar-benar berstatus itu di UI).
const DELIVERY_STATUS_MAP: Record<RawPengiriman['status'], Delivery['status']> = {
  Draft: 'menunggu',
  Dijadwalkan: 'dijemput',
  'Dalam Perjalanan': 'perjalanan',
  Terkirim: 'terkirim',
  Dibatalkan: 'gagal',
};

function mapPengiriman(raw: RawPengiriman): Delivery {
  return {
    id: String(raw.id),
    code: raw.nomorPengiriman,
    origin: raw.gudangAsal?.nama ?? '-',
    originGudangId: raw.gudangAsalId,
    originAddress: raw.gudangAsal?.alamat ?? undefined,
    originPhone: raw.gudangAsal?.telepon ?? undefined,
    originLatitude: raw.gudangAsal?.latitude ?? undefined,
    originLongitude: raw.gudangAsal?.longitude ?? undefined,
    // "Order ID" di resi = nomor dokumen Barang Keluar yang mendasari
    // pengiriman ini (kalau ada) — itu yang secara bisnis disebut "order"
    // yang sedang dipenuhi, bukan ID internal pengiriman itu sendiri.
    orderId: raw.barangKeluar?.nomorPengeluaran ?? undefined,
    items: raw.barangKeluar?.items?.map((it) => ({
      sku: it.barang?.kodeBarang ?? '-',
      name: it.barang?.nama ?? '-',
      qty: it.qty,
      unit: it.barang?.satuan?.singkatan ?? it.barang?.satuan?.nama ?? '',
      weightGram: it.barang?.beratGram ?? undefined,
    })),
    destination: raw.alamatTujuan || raw.namaPenerima,
    destLatitude: raw.destLat ?? undefined,
    destLongitude: raw.destLng ?? undefined,
    courierName: raw.namaKurir || '-',
    distanceKm: 0,
    status: DELIVERY_STATUS_MAP[raw.status] ?? 'menunggu',
    type: raw.jenisPengambilan,
    scheduledAt: raw.tanggalKirim,
    deliveredAt: raw.waktuTerkirim ?? undefined,
    latitude: raw.lastLat ?? undefined,
    longitude: raw.lastLng ?? undefined,
    receiverName: raw.namaPenerima,
    receiverPhone: raw.teleponPenerima,
    courierPhone: raw.teleponKurir,
    notes: raw.catatan,
    isProtected: raw.isProtected ?? false,
  };
}

export interface DeliveryPayload {
  gudangAsalId: number;
  jenisPengambilan: 'pickup' | 'dropoff';
  namaPenerima: string;
  teleponPenerima?: string;
  alamatTujuan?: string;
  destLat?: number | null;
  destLng?: number | null;
  tanggalKirim: string; // YYYY-MM-DD
  catatan?: string;
}

export const deliveriesApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Delivery>> => {
    const { data, meta } = await apiClient.getPaginated<RawPengiriman>(
      `/pengiriman${buildQuery(params)}`,
    );
    return {
      data: data.map(mapPengiriman),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: async (id: string): Promise<Delivery> => mapPengiriman(await apiClient.get<RawPengiriman>(`/pengiriman/${id}`)),
  create: (payload: DeliveryPayload) => apiClient.post<RawPengiriman>('/pengiriman', payload),
  update: (id: string, payload: DeliveryPayload) => apiClient.put<RawPengiriman>(`/pengiriman/${id}`, payload),
  remove: (id: string) => apiClient.delete<void>(`/pengiriman/${id}`),
  /** PATCH /pengiriman/:id/jadwalkan — draft -> terjadwal, assign kurir.
   * WAJIB dilakukan sebelum "mulai", dan "mulai" wajib sebelum ping GPS
   * mulai diterima backend (lihat catatan panjang di komponen
   * PickupDropoff.tsx soal kenapa ini penting untuk live tracking). */
  jadwalkan: (id: string, payload: { namaKurir: string; teleponKurir?: string; estimasiTiba?: string }) =>
    apiClient.patch<RawPengiriman>(`/pengiriman/${id}/jadwalkan`, payload),
  /** PATCH /pengiriman/:id/mulai — terjadwal -> dalam_perjalanan. SETELAH
   * ini statusnya baru "dalam_perjalanan" dan backend baru mau menerima
   * ping GPS dari kurir (POST .../lokasi menolak selama status lain). */
  mulai: (id: string) => apiClient.patch<RawPengiriman>(`/pengiriman/${id}/mulai`),
  /** PATCH /pengiriman/:id/selesai — tandai pengiriman berhasil sampai
   * tujuan (dijadwalkan/dikirim -> terkirim). */
  complete: (id: string, catatan?: string) =>
    apiClient.patch<RawPengiriman>(`/pengiriman/${id}/selesai`, { catatan }),
  /** GET /pengiriman/:id/lokasi — posisi kurir terakhir (bukan /deliveries/:id/track).
   * Backend mengirim field lastLat/lastLng/lastLocationAt (lihat
   * `response` struct di LokasiTerkini, pengiriman_controller.go) — di-map
   * ke {lat,lng,recordedAt} di sini SEBELUM dipakai pemanggil, supaya
   * nama field yang salah tidak bikin polling GPS di LiveTrackingMap.tsx
   * selalu gagal diam-diam (lat/lng lama-lama undefined, bukan null).
   */
  track: async (id: string): Promise<{ lat: number | null; lng: number | null; recordedAt: string | null }> => {
    const raw = await apiClient.get<{ lastLat: number | null; lastLng: number | null; lastLocationAt: string | null }>(
      `/pengiriman/${id}/lokasi`,
    );
    return { lat: raw.lastLat, lng: raw.lastLng, recordedAt: raw.lastLocationAt };
  },
  /** POST /pengiriman/:id/lokasi — ping posisi GPS real-time dari perangkat
   * kurir (dipanggil berkala oleh ShareLocationButton via
   * navigator.geolocation.watchPosition). */
  sendLocation: (id: string, payload: { lat: number; lng: number; kecepatanKmh?: number }) =>
    apiClient.post<unknown>(`/pengiriman/${id}/lokasi`, payload),
  /** PATCH /pengiriman/:id/protect — khusus super_admin. */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<RawPengiriman>(`/pengiriman/${id}/protect`, { is_protected: isProtected }),
};

// ---------------------------------------------------------------------------
// Modul berikut path-nya SUDAH DIPERBAIKI ke endpoint backend yang benar,
// tapi mapper field-nya BELUM ditulis (bentuk baris item bertingkat di
// backang-masuk/keluar & stock-opname cukup berbeda dari tipe UI datar
// yang ada sekarang) — perlu sesi lanjutan yang fokus ke modul ini secara
// dedicated, sama seperti barang/supplier/po/pengiriman di atas.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Barang Masuk (Goods In) — REAL, /barang-masuk. Dokumen berbentuk header +
// baris item (barang_id, qty, harga_satuan), dengan alur draft -> selesai
// (stok & rak diperbarui otomatis oleh backend) atau draft -> dibatalkan.
// Hanya dokumen berstatus draft yang boleh diubah/dihapus.
// ---------------------------------------------------------------------------
export interface GoodsItemPayload {
  barang_id: number;
  rak_id?: number;
  qty: number;
  harga_satuan?: number;
}

export interface GoodsInPayload {
  purchase_order_id?: number;
  supplier_id?: number;
  gudang_id: number;
  tanggal: string; // YYYY-MM-DD
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
  /** PATCH /barang-masuk/:id/selesai — selesaikan dokumen (stok & rak ikut diperbarui). */
  complete: (id: string) => apiClient.patch<RawBarangMasuk>(`/barang-masuk/${id}/selesai`, {}),
  /** PATCH /barang-masuk/:id/batalkan */
  cancel: (id: string) => apiClient.patch<RawBarangMasuk>(`/barang-masuk/${id}/batalkan`, {}),
};

// ---------------------------------------------------------------------------
// Barang Keluar (Goods Out) — REAL, /barang-keluar. Sama pola dengan Barang
// Masuk tapi tanpa harga_satuan, dan wajib keperluan/penerima.
// ---------------------------------------------------------------------------
export interface GoodsOutPayload {
  gudang_id: number;
  tanggal: string; // YYYY-MM-DD
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
  /** PATCH /barang-keluar/:id/selesai */
  complete: (id: string) => apiClient.patch<RawBarangKeluar>(`/barang-keluar/${id}/selesai`, {}),
  /** PATCH /barang-keluar/:id/batalkan */
  cancel: (id: string) => apiClient.patch<RawBarangKeluar>(`/barang-keluar/${id}/batalkan`, {}),
};

/** Bentuk field asli /stock-opname (baris per opname, bukan per SKU
 * seperti tipe UI `InventoryRecord`) belum dipetakan — dityped ke
 * `InventoryRecord` supaya halaman existing tetap compile; data asli
 * kemungkinan perlu transformasi tambahan (agregasi per SKU) sebelum
 * sungguh cocok tampil di tabel ini. */
export interface StockOpnameItemPayload {
  barangId: number;
  stokFisik: number;
  catatan?: string;
}

export interface StockOpnamePayload {
  gudangId: number;
  tanggal: string; // YYYY-MM-DD
  catatan?: string;
  items: StockOpnameItemPayload[];
}

/** GET/POST/PUT/PATCH/DELETE /stock-opname — SEBELUMNYA generic pass-
 * through tanpa pemetaan field sama sekali (usersApi lama juga pernah
 * begini): backend mengembalikan DOKUMEN (banyak item per sesi), tapi
 * frontend mengharapkan baris flat per-SKU (`InventoryRecord`) DAN
 * "Sesuaikan Stok" mengirim `{quantity}` yang sama sekali tidak dikenali
 * backend. `list()` di bawah meratakan dokumen jadi baris per item;
 * create/update memakai bentuk dokumen asli. */
export const inventoryApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<InventoryRecord>> => {
    const { data, meta } = await apiClient.getPaginated<RawStockOpname>(
      `/stock-opname${buildQuery({ ...params, pageSize: 100 })}`,
    );
    const flattened = data.flatMap(mapStockOpnameToRecords);
    return {
      data: flattened,
      page: meta?.page ?? 1,
      pageSize: flattened.length,
      total: flattened.length,
    };
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
  /** PATCH /stock-opname/:id/selesai — menerapkan selisih ke stok Barang. */
  complete: (id: string) => apiClient.patch<RawStockOpname>(`/stock-opname/${id}/selesai`),
  batalkan: (id: string) => apiClient.patch<RawStockOpname>(`/stock-opname/${id}/batalkan`),
};

/** GET/POST/PUT/PATCH/DELETE /aset — Manajemen Aset Gudang (lihat
 * internal/controller/asset). Label RSD / kode BA dibuat OTOMATIS oleh
 * server saat Create — TIDAK dikirim dari klien. */
export interface AssetPayload {
  nama: string;
  jenisAset: JenisAset;
  gudangId: number;
  latitude?: number | null;
  longitude?: number | null;
  keterangan?: string;
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
  /** PATCH /aset/:id/status — menandai kondisi aset (aktif/rusak/nonaktif). */
  setStatus: (id: string, status: 'aktif' | 'rusak' | 'nonaktif') =>
    apiClient.patch<RawAsset>(`/aset/${id}/status`, { status }),
  remove: (id: string) => apiClient.delete<void>(`/aset/${id}`),
};

/** GET/POST/PUT/PATCH/DELETE /barang-rusak — modul Barang Rusak (lihat
 * internal/controller/barang_rusak). Status selalu dibuat "pengecekan"
 * oleh server; gunakan `inspeksi()` untuk mengunci hasil pemeriksaan
 * fisik menjadi "retur" atau "rusak". */
export interface BarangRusakPayload {
  barangId?: number | null;
  labelBarang: string;
  namaBarang: string;
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
  /** PATCH /barang-rusak/:id/inspeksi — hasil pengecekan fisik, HANYA
   * super_admin & admin. Mengunci status jadi "retur" atau "rusak". */
  inspeksi: (id: string, jenisBarang: 'retur' | 'rusak') =>
    apiClient.patch<RawBarangRusak>(`/barang-rusak/${id}/inspeksi`, { jenis_barang: jenisBarang }),
  remove: (id: string) => apiClient.delete<void>(`/barang-rusak/${id}`),
};

/** GET/POST/PUT/DELETE /users — Manajemen User (Super Admin).
 * Backend memakai nama field (`full_name`, `role_id`, `is_active`) yang
 * beda dari tipe UI `ManagedUser` (`name`, `role`, `status`) — perlu
 * mapping eksplisit (mapUserRaw), BUKAN generic createResourceApi
 * pass-through, supaya kolom Role/Status/Login Terakhir di tabel Manajemen
 * User tidak kosong lagi. Create juga wajib `role_id` (angka), jadi
 * resolveRoleId() menerjemahkan pilihan role di form ('admin', dst) lewat
 * daftar role sungguhan dari GET /roles.
 */
export interface ManagedUserPayload {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  /** Wajib diisi saat membuat user baru; diabaikan saat update. */
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
    // Cache mungkin basi (role baru dibuat setelah cache terisi) — muat ulang sekali.
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
      roleId,
    });
    return mapUserRaw(raw);
  },
  update: async (id: string, payload: Partial<ManagedUserPayload>): Promise<ManagedUser> => {
    const roleId = payload.role ? await resolveRoleId(payload.role) : undefined;
    const raw = await apiClient.put<RawUser>(`/users/${id}`, {
      email: payload.email,
      fullName: payload.name,
      roleId,
    });
    return mapUserRaw(raw);
  },
  remove: (id: string) => apiClient.delete<void>(`/users/${id}`),
};

/** GET /maintenance/status (publik, tanpa auth — supaya user yang diblokir
 * tetap bisa lihat pesannya) & PUT /maintenance (khusus super_admin). */
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

/** Bentuk asli model.CodTransaction (backend) setelah camelCase. */
export type CodStatus = 'menunggu' | 'lunas' | 'bermasalah';
export interface CodTransactionRaw {
  id: number;
  kode: string;
  pelanggan: string;
  nominal: number;
  kurir: string;
  tanggal: string;
  status: CodStatus;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CodCreatePayload {
  kode: string;
  pelanggan: string;
  nominal: number;
  kurir: string;
  tanggal: string; // YYYY-MM-DD
  status: CodStatus;
}

export interface CodSummary {
  total: number;
  lunas: number;
  menunggu: number;
  bermasalah: number;
  totalNominal: number;
}

const codResource = createResourceApi<CodTransactionRaw, CodCreatePayload>('/cod');

export const codApi = {
  list: codResource.list,
  create: codResource.create,
  update: (id: string, payload: CodCreatePayload) => codResource.update(id, payload),
  remove: codResource.remove,
  summary: () => apiClient.get<CodSummary>('/cod/summary'),
  /** PATCH /cod/:id/protect — khusus super_admin (backend juga menggerbang ulang). */
  setProtected: (id: string, isProtected: boolean) =>
    apiClient.patch<CodTransactionRaw>(`/cod/${id}/protect`, { isProtected }),
};

// ---------------------------------------------------------------------------
// Kategori — REAL, /gudang/kategori. Dipakai untuk dropdown filter kategori
// di halaman Barang Masuk & Barang Keluar.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Satuan — REAL, /gudang/satuan. Dipakai untuk dropdown "Satuan" di form
// Tambah/Ubah Barang (barang.satuan_id wajib diisi ID numerik oleh backend).
// ---------------------------------------------------------------------------
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

/** Satu baris matrix perizinan — 1:1 dengan ModulePermissionItem backend
 * (internal/controller/role/struct.go). */
export interface PermissionMatrixItem {
  module: string;
  view: boolean;
  tambah: boolean;
  edit: boolean;
  approvalReject: boolean;
  print: boolean;
  assignDelegasi: boolean;
}

/** GET /roles + GET/PUT /roles/:id/permissions */
export const rolesApi = {
  list: () => apiClient.get<Array<{ id: number; name: string }>>('/roles'),
  getPermissionMatrix: (id: number) =>
    apiClient.get<{ roleId: number; items: PermissionMatrixItem[] }>(`/roles/${id}/permissions`),
  updatePermissionMatrix: (id: number, items: PermissionMatrixItem[]) =>
    apiClient.put<null>(`/roles/${id}/permissions`, { items }),
};

// ---------------------------------------------------------------------------
// Dashboard — bentuk asli backend (internal/controller/dashboard/struct.go)
// adalah ringkasan angka PER MODUL, bukan array StatMetric generik seperti
// asumsi lama. /dashboard/trend juga endpoint TERPISAH dari /summary.
// ---------------------------------------------------------------------------
export interface DashboardSummaryRaw {
  kelolaBarang: { totalBarang: number; stokMenipis: number; totalNilaiInventaris: number };
  gudang: { totalGudang: number; totalRak: number; rakPenuh: number; rakKosong: number };
  supplier: { totalSupplier: number; supplierAktif: number };
  purchaseOrder: { totalPo: number; menungguPersetujuan: number; disetujui: number };
  barangMasuk: { draft: number; selesai: number };
  barangKeluar: { draft: number; selesai: number };
  stockOpname: { draft: number; selesai: number };
  pengiriman: { dalamPerjalanan: number; terkirim: number };
}

export interface DashboardTrendPointRaw {
  bulan: string;
  masuk: number;
  keluar: number;
}

/** internal/controller/dashboard AnalisaResponse struct. */
export interface AnalisaRaw {
  totalSku: number;
  totalRestockBulanIni: number;
  stokMenipis: number;
  kategoriComposition: Array<{ label: string; value: number }>;
  topRestocked: Array<{ name: string; value: number }>;
  topKeluar: Array<{ name: string; value: number }>;
}

/** GET /laporan/preview — dipakai ReportPageTemplate untuk menampilkan
 * data ASLI (bukan dummy) sebelum diunduh. Bentuk headers/rows generik
 * karena tiap tipe laporan kolomnya beda-beda (lihat backend buildReport). */
export interface LaporanPreview {
  title: string;
  headers: string[];
  rows: string[][];
  summary: Array<{ label: string; value: string }>;
}

/** GET /app/version & GET /app/changelog — publik, tanpa perlu login.
 * Dipakai halaman /changelog dan VersionWatcher (cek update otomatis). */
export interface AppVersionInfo {
  version: string;
  appName: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    new?: string[];
    fix?: string[];
  };
}

export const appInfoApi = {
  version: () => apiClient.get<AppVersionInfo>('/app/version'),
  changelog: () => apiClient.get<ChangelogEntry[]>('/app/changelog'),
};

export const laporanApi = {
  preview: (tipe: string, dari?: string, sampai?: string) => {
    const params = new URLSearchParams({ tipe });
    if (dari) params.set('dari', dari);
    if (sampai) params.set('sampai', sampai);
    return apiClient.get<LaporanPreview>(`/laporan/preview?${params.toString()}`);
  },
};

export const dashboardApi = {
  /** GET /dashboard/summary */
  summary: () => apiClient.get<DashboardSummaryRaw>('/dashboard/summary'),
  /** GET /dashboard/trend — tren barang masuk/keluar 6 bulan terakhir */
  trend: () => apiClient.get<DashboardTrendPointRaw[]>('/dashboard/trend'),
  /** GET /dashboard/activity */
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
  /** GET /dashboard/analisa — dipakai halaman Analisa Data, semua angka REAL. */
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

// Dipertahankan supaya kompatibel dengan kode lama yang import UserRole dari sini.
export type { UserRole };
