import { useState } from 'react';
import { useResourceList, type ResourceListApi } from '@/lib/hooks/useResourceList';
import type { ListParams } from '@/lib/api/resource';
import type { ServerPaginationConfig } from '@/component/ui/DataTable';

/**
 * Pilihan jumlah data per halaman yang bisa dipilih user lewat dropdown di
 * DataTable — makin besar limitnya, makin sedikit jumlah "klik next" yang
 * dibutuhkan, tapi tetap dibatasi (bukan "Semua") supaya satu request tidak
 * menarik ribuan baris sekaligus dan bikin UI lag. Backend (PaginationFromContext)
 * ikut membatasi limit maksimum ke 500 sebagai jaring pengaman kedua.
 */
export const PAGE_LIMIT_OPTIONS = [10, 100, 200, 500] as const;
export type PageLimit = (typeof PAGE_LIMIT_OPTIONS)[number];

export interface ServerPaginatedList<T> {
  /** Baris data untuk HALAMAN AKTIF SAJA (hasil offset+limit) — bukan seluruh data. */
  rows: T[];
  /** Total baris yang cocok filter di seluruh halaman (dari backend). */
  total: number;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
  page: number;
  limit: number;
  /** Siap-pakai: tinggal spread ke prop `serverPagination` DataTable. */
  serverPagination: ServerPaginationConfig;
}

/**
 * Hook generik untuk daftar data dengan pagination server-side asli
 * (offset/limit lewat query `page` & `limit`, BUKAN slice di memori client).
 * Mengganti limit atau search otomatis mereset ke halaman 1 dan mem-fetch
 * ulang cuma HALAMAN itu saja ("lazy load" per halaman), supaya tabel besar
 * (ratusan/ribuan baris) tidak bikin browser lag.
 */
export function useServerPaginatedList<T>(
  key: string,
  api: ResourceListApi<T>,
  extraParams?: Omit<ListParams, 'page' | 'pageSize'>,
  options?: { initialLimit?: PageLimit; refreshIntervalMs?: number },
): ServerPaginatedList<T> {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(options?.initialLimit ?? PAGE_LIMIT_OPTIONS[0]);

  // Reset ke halaman 1 saat filter/search/limit berubah — disesuaikan SAAT
  // render (bukan lewat useEffect) mengikuti pola resmi React untuk
  // "adjust state saat prop berubah", supaya tidak ada cascading render
  // ekstra dari setState di dalam efek.
  const searchKey = JSON.stringify(extraParams ?? {});
  const resetKey = `${searchKey}::${limit}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const params: ListParams = { ...extraParams, page, pageSize: limit };
  const { rows, total, isLoading, error, mutate } = useResourceList<T>(
    key,
    api,
    params,
    options?.refreshIntervalMs,
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);

  function onPageChange(next: number): void {
    setPage(Math.min(totalPages, Math.max(1, next)));
  }

  function onLimitChange(next: number): void {
    setLimit(next);
    setPage(1);
  }

  return {
    rows,
    total,
    isLoading,
    error,
    mutate,
    page: safePage,
    limit,
    serverPagination: {
      page: safePage,
      totalPages,
      onPageChange,
      limit,
      limitOptions: [...PAGE_LIMIT_OPTIONS],
      onLimitChange,
      total,
    },
  };
}
