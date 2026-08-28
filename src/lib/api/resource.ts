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

    const queryKey = key === 'pageSize' ? 'limit' : key;
    searchParams.set(queryKey, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

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
