import useSWR from 'swr';
import type { ListParams } from '@/lib/api/resource';
import type { PaginatedResult } from '@/types';

export interface ResourceListApi<T> {
  list: (params?: ListParams) => Promise<PaginatedResult<T>>;
}

/**
 * Mengambil daftar data dari REST API gostock via SWR — TIDAK ADA fallback
 * data contoh/dummy. Kalau backend belum bisa dihubungi atau requestnya
 * gagal, `rows` kosong dan `error` terisi, supaya halaman bisa menampilkan
 * status yang jujur ("gagal memuat data") alih-alih diam-diam menampilkan
 * data karangan yang bisa disalahartikan sebagai data asli.
 *
 * `refreshIntervalMs` (opsional): polling berkala — dipakai untuk data yang
 * perlu terlihat "real-time" (mis. status online di Manajemen User),
 * SENGAJA opsional (bukan default semua resource) supaya tabel lain yang
 * tidak butuh live-update tidak membebani server dengan polling percuma.
 */
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
