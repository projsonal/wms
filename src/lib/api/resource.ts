import { apiClient } from '@/lib/api/client';
import type { PaginatedResult } from '@/types';

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  [key: string]: string | number | undefined;
}

function buildQuery(params: ListParams = {}): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    // Backend gostock (pkg/utils/pagination.go) membaca `limit`, bukan
    // `pageSize` — nama field TS tetap `pageSize` demi konsistensi dengan
    // PaginatedResult, tapi di query string diterjemahkan ke `limit`.
    const queryKey = key === 'pageSize' ? 'limit' : key;
    searchParams.set(queryKey, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * Membuat kumpulan fungsi CRUD standar untuk sebuah resource REST.
 * Menghindari duplikasi boilerplate fetch di setiap modul (barang, supplier, dst).
 *
 * Catatan bentuk respons backend gostock: endpoint list membalas
 * `{ data: [...], meta: { page, limit, totalItems, totalPages } }` — info
 * paginasi ada di `meta`, BUKAN di dalam `data`. Fungsi ini yang merangkai
 * keduanya jadi bentuk `PaginatedResult<T>` yang dipakai komponen UI.
 */
export function createResourceApi<TEntity, TCreatePayload = Partial<TEntity>>(basePath: string) {
  return {
    list: async (params?: ListParams): Promise<PaginatedResult<TEntity>> => {
      const { data, meta } = await apiClient.getPaginated<TEntity>(`${basePath}${buildQuery(params)}`);
      return {
        data,
        page: meta?.page ?? 1,
        pageSize: meta?.limit ?? data.length,
        total: meta?.totalItems ?? data.length,
      };
    },

    getById: (id: string) => apiClient.get<TEntity>(`${basePath}/${id}`),

    create: (payload: TCreatePayload) => apiClient.post<TEntity>(basePath, payload),

    update: (id: string, payload: Partial<TCreatePayload>) =>
      apiClient.put<TEntity>(`${basePath}/${id}`, payload),

    remove: (id: string) => apiClient.delete<void>(`${basePath}/${id}`),
  };
}
