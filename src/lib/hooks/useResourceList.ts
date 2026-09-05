import useSWR from 'swr';
import type { ListParams } from '@/lib/api/resource';
import type { PaginatedResult } from '@/types';

export interface ResourceListApi<T> {
  list: (params?: ListParams) => Promise<PaginatedResult<T>>;
}

// Interval polling default supaya daftar tetap ter-update sendiri (mis. user
// lain menambah/mengubah data) tanpa perlu refresh manual di browser. Bisa
// dimatikan per-pemanggil dengan mengirim refreshIntervalMs: 0.
const DEFAULT_REFRESH_INTERVAL_MS = 20_000;

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
      // Sinkron otomatis: refetch begitu tab/window difokuskan lagi atau
      // koneksi internet pulih, plus polling berkala — supaya user tidak
      // harus menekan refresh manual untuk melihat perubahan data terbaru.
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
      refreshInterval: refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
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
