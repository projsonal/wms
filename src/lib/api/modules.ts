import { apiClient } from '@/lib/api/client';
import { createResourceApi } from '@/lib/api/resource';
import { mapBarangToItem, mapItemToBarangPayload, mapSupplierRaw } from '@/lib/api/mappers';
import type {
  RawBarang,
  RawGudang,
  RawPengiriman,
  RawPurchaseOrder,
  RawSupplier,
} from '@/lib/api/raw-types';
import type {
  Delivery,
  InventoryRecord,
  Item,
  ManagedUser,
  PaginatedResult,
  PurchaseOrder,
  Supplier,
  Task,
  UserRole,
  Warehouse,
} from '@/types';
import type { ListParams } from '@/lib/api/resource';

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
 *   /users             Manajemen User        (sudah benar)
 *   /roles             Role & Permission Matrix
 *   /dashboard/summary + /dashboard/trend + /dashboard/activity + ...
 *
 * TIDAK ADA padanan backend untuk "tasks" (Task Management) — modul itu
 * belum diimplementasikan di gowms sama sekali, jadi tasksApi di bawah
 * masih memanggil endpoint yang akan selalu 404 sampai backend-nya dibuat.
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
      kode: payload.name?.slice(0, 8).toUpperCase(),
      nama: payload.name,
      pic: payload.contactPerson,
      telepon: payload.phone,
      email: payload.email,
      alamat: payload.address,
    }),
  update: (id: string, payload: Partial<Supplier>) =>
    apiClient.put<RawSupplier>(`/supplier/${id}`, {
      nama: payload.name,
      pic: payload.contactPerson,
      telepon: payload.phone,
      email: payload.email,
      alamat: payload.address,
    }),
  remove: (id: string) => apiClient.delete<void>(`/supplier/${id}`),
};

// ---------------------------------------------------------------------------
// Gudang (Warehouse) — backend TIDAK punya field capacity/usedCapacity/
// totalItems/picName (hanya id, nama, alamat, daftar rak). Kolom itu akan
// selalu kosong/0 sampai backend menambah data tsb. Path sudah benar (/gudang)
// supaya minimal nama & alamat asli tampil.
// ---------------------------------------------------------------------------
export const warehousesApi = {
  list: async (params?: ListParams): Promise<PaginatedResult<Warehouse>> => {
    const { data, meta } = await apiClient.getPaginated<RawGudang>(
      `/gudang${buildQuery(params)}`,
    );
    return {
      data: data.map(
        (raw): Warehouse => ({
          id: String(raw.id),
          name: raw.nama,
          code: '-',
          address: raw.alamat ?? '-',
          capacity: 0,
          usedCapacity: 0,
          totalItems: 0,
          picName: '-',
          status: 'aktif',
        }),
      ),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: (id: string) => apiClient.get<RawGudang>(`/gudang/${id}`),
  create: (payload: Partial<Warehouse>) => apiClient.post<RawGudang>('/gudang', { nama: payload.name, alamat: payload.address }),
  update: (id: string, payload: Partial<Warehouse>) =>
    apiClient.put<RawGudang>(`/gudang/${id}`, { nama: payload.name, alamat: payload.address }),
  remove: (id: string) => apiClient.delete<void>(`/gudang/${id}`),
};

// ---------------------------------------------------------------------------
// Purchase Order — status backend (draft/diajukan/disetujui/ditolak/
// dibatalkan) BEDA kosakata dari status UI lama (draft/diproses/dikirim/
// selesai/dibatalkan). Dipetakan ke status UI terdekat; sesuaikan lagi
// kalau mau istilah asli backend yang tampil ke pengguna.
// ---------------------------------------------------------------------------
const PO_STATUS_MAP: Record<RawPurchaseOrder['status'], PurchaseOrder['status']> = {
  draft: 'draft',
  diajukan: 'diproses',
  disetujui: 'dikirim',
  ditolak: 'dibatalkan',
  dibatalkan: 'dibatalkan',
};

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
          supplierName: raw.supplier?.nama ?? '-',
          itemCount: raw.items?.length ?? 0,
          totalAmount: raw.totalEstimasi,
          orderDate: raw.tanggalPo,
          expectedDate: raw.tanggalPo,
          status: PO_STATUS_MAP[raw.status] ?? 'draft',
        }),
      ),
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? data.length,
      total: meta?.totalItems ?? data.length,
    };
  },
  getById: (id: string) => apiClient.get<RawPurchaseOrder>(`/purchase-order/${id}`),
  remove: (id: string) => apiClient.delete<void>(`/purchase-order/${id}`),
};

// ---------------------------------------------------------------------------
// Pengiriman (Delivery) — status backend (draft/terjadwal/dikirim/terkirim/
// dibatalkan) dipetakan ke DeliveryStatus UI (menunggu/dijemput/perjalanan/
// terkirim/gagal); "gagal" tidak punya padanan asli di backend saat ini.
// ---------------------------------------------------------------------------
const DELIVERY_STATUS_MAP: Record<RawPengiriman['status'], Delivery['status']> = {
  draft: 'menunggu',
  terjadwal: 'dijemput',
  dikirim: 'perjalanan',
  terkirim: 'terkirim',
  dibatalkan: 'gagal',
};

function mapPengiriman(raw: RawPengiriman): Delivery {
  return {
    id: String(raw.id),
    code: raw.nomorPengiriman,
    origin: raw.gudangAsal?.nama ?? '-',
    destination: raw.alamatTujuan || raw.namaPenerima,
    courierName: raw.namaKurir || '-',
    distanceKm: 0,
    status: DELIVERY_STATUS_MAP[raw.status] ?? 'menunggu',
    scheduledAt: raw.tanggalKirim,
    latitude: raw.lastLat ?? undefined,
    longitude: raw.lastLng ?? undefined,
  };
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
  /** GET /pengiriman/:id/lokasi — posisi kurir terakhir (bukan /deliveries/:id/track) */
  track: (id: string) => apiClient.get<{ lat: number | null; lng: number | null; recordedAt: string | null }>(`/pengiriman/${id}/lokasi`),
};

// ---------------------------------------------------------------------------
// Modul berikut path-nya SUDAH DIPERBAIKI ke endpoint backend yang benar,
// tapi mapper field-nya BELUM ditulis (bentuk baris item bertingkat di
// backang-masuk/keluar & stock-opname cukup berbeda dari tipe UI datar
// yang ada sekarang) — perlu sesi lanjutan yang fokus ke modul ini secara
// dedicated, sama seperti barang/supplier/po/pengiriman di atas.
// ---------------------------------------------------------------------------
export const goodsInApi = createResourceApi<Record<string, unknown>>('/barang-masuk');
export const goodsOutApi = createResourceApi<Record<string, unknown>>('/barang-keluar');
/** Bentuk field asli /stock-opname (baris per opname, bukan per SKU
 * seperti tipe UI `InventoryRecord`) belum dipetakan — dityped ke
 * `InventoryRecord` supaya halaman existing tetap compile; data asli
 * kemungkinan perlu transformasi tambahan (agregasi per SKU) sebelum
 * sungguh cocok tampil di tabel ini. */
export const inventoryApi = createResourceApi<InventoryRecord>('/stock-opname');

/** TIDAK ADA endpoint backend untuk ini — lihat catatan di atas file.
 * Dityped ke `Task` supaya halaman Task Management tetap compile; runtime
 * data-nya akan selalu gagal (404) sampai backend modul ini dibuat. */
export const tasksApi = createResourceApi<Task>('/tasks');

/** GET/POST/PUT/DELETE /users — Manajemen User (Super Admin) — sudah benar sejak awal. */
export const usersApi = createResourceApi<ManagedUser, ManagedUser & { password?: string }>(
  '/users',
);

/** GET /roles + GET/PUT /roles/:id/permissions */
export const rolesApi = {
  list: () => apiClient.get<Array<{ id: number; nama: string }>>('/roles'),
  getPermissionMatrix: (id: number) => apiClient.get<unknown>(`/roles/${id}/permissions`),
  updatePermissionMatrix: (id: number, payload: unknown) =>
    apiClient.put<unknown>(`/roles/${id}/permissions`, payload),
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

export const dashboardApi = {
  /** GET /dashboard/summary */
  summary: () => apiClient.get<DashboardSummaryRaw>('/dashboard/summary'),
  /** GET /dashboard/trend — tren barang masuk/keluar 6 bulan terakhir */
  trend: () => apiClient.get<DashboardTrendPointRaw[]>('/dashboard/trend'),
  /** GET /dashboard/activity */
  activity: () => apiClient.get<unknown[]>('/dashboard/activity'),
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
