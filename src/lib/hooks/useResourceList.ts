import useSWR from 'swr';
import type { ListParams } from '@/lib/api/resource';
import type { PaginatedResult } from '@/types';

export interface ResourceListApi<T> {
  list: (params?: ListParams) => Promise<PaginatedResult<T>>;
}

export function useResourceList<T>(
  key: string,
  api: ResourceListApi<T>,
  params?: ListParams,
  refreshIntervalMs?: number,
) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>>(
    [key, params],
    () => api.list(params),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      refreshInterval: refreshIntervalMs,
    },
  );

  return {
    rows: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
