import useSWR from 'swr';
import type { ListParams } from '@/lib/api/resource';
import type { PaginatedResult } from '@/types';

export interface ResourceListApi<T> {
  list: (params?: ListParams) => Promise<PaginatedResult<T>>;
}

function toFallback<T>(data: T[]): PaginatedResult<T> {
  return { data, page: 1, pageSize: data.length, total: data.length };
}

/**
 * Mengambil daftar data dari REST API gostock via SWR.
 * `fallbackSeed` ditampilkan sementara backend belum tersedia,
 * lalu otomatis digantikan begitu API merespons.
 */
export function useResourceList<T>(
  key: string,
  api: ResourceListApi<T>,
  fallbackSeed: T[],
  params?: ListParams,
) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>>(
    [key, params],
    () => api.list(params),
    {
      fallbackData: toFallback(fallbackSeed),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  return {
    rows: data?.data ?? fallbackSeed,
    total: data?.total ?? fallbackSeed.length,
    isLoading,
    isUsingFallback: Boolean(error) || !data,
    mutate,
  };
}
