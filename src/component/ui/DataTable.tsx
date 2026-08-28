'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/component/ui/Card';
import { TableRowActionBar, type TableRowAction } from '@/component/ui/TableRowActionBar';

export type { TableRowAction };

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  title: string;
  description?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  isLoading?: boolean;

  errorMessage?: string;
  toolbar?: ReactNode;

  onRowAction?: (action: TableRowAction) => void;

  visibleActions?: TableRowAction[];

  module?: string;

  serverPagination?: ServerPaginationConfig;
}

export interface ServerPaginationConfig {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Jumlah baris per halaman saat ini (offset/limit) — dari dropdown limit. */
  limit?: number;
  /** Pilihan limit yang muncul di dropdown, mis. [10, 100, 200, 500]. */
  limitOptions?: number[];
  onLimitChange?: (limit: number) => void;
  /** Total baris yang cocok filter (opsional, untuk teks info "x dari y data"). */
  total?: number;
}

const PAGE_WINDOW = 2;

/**
 * Bangun daftar nomor halaman yang ditampilkan sebagai tombol, dibatasi
 * jendela di sekitar halaman aktif + halaman pertama/terakhir, dengan "…"
 * di antaranya. Ini mencegah render RATUSAN tombol saat totalPages besar
 * (mis. 500 baris/halaman x banyak data), yang sebelumnya bikin UI lag.
 */
function buildPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current]);
  for (let offset = 1; offset <= PAGE_WINDOW; offset += 1) {
    if (current - offset >= 1) pages.add(current - offset);
    if (current + offset <= total) pages.add(current + offset);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((p, idx) => {
    if (idx > 0 && p - sorted[idx - 1] > 1) {
      result.push('ellipsis');
    }
    result.push(p);
  });
  return result;
}

function LimitSelect({ serverPagination }: Readonly<{ serverPagination: ServerPaginationConfig }>): React.JSX.Element | null {
  if (!serverPagination.onLimitChange) {
    return null;
  }
  const options = serverPagination.limitOptions ?? [10, 100, 200, 500];
  return (
    <label className="flex items-center gap-1.5 text-xs text-textMuted">
      Tampilkan
      <select
        value={serverPagination.limit ?? options[0]}
        onChange={(event) => serverPagination.onLimitChange?.(Number(event.target.value))}
        aria-label="Jumlah data per halaman"
        className="rounded-full border border-borderSoft bg-surfaceAlt px-3 py-1.5 text-xs font-semibold text-text outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt} data
          </option>
        ))}
      </select>
    </label>
  );
}

function PageNumberButtons({
  currentPage,
  totalPages,
  tableTitle,
  goToPage,
}: Readonly<{
  currentPage: number;
  totalPages: number;
  tableTitle: string;
  goToPage: (page: number) => void;
}>): React.JSX.Element {
  return (
    <>
      {buildPageWindow(currentPage, totalPages).map((pageNumber, idx) =>
        pageNumber === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-8 w-8 items-center justify-center text-sm text-textMuted"
          >
            …
          </span>
        ) : (
          <motion.button
            key={pageNumber}
            type="button"
            onClick={() => goToPage(pageNumber)}
            aria-current={pageNumber === currentPage}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-textMuted transition-colors hover:bg-surfaceAlt"
          >
            {pageNumber === currentPage ? (
              <motion.span
                layoutId={`${tableTitle}-page-pill`}
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <span className={`relative z-10 ${pageNumber === currentPage ? 'text-white' : ''}`}>
              {pageNumber}
            </span>
          </motion.button>
        ),
      )}
    </>
  );
}

function CompactPager({
  currentPage,
  totalPages,
  goToPage,
}: Readonly<{ currentPage: number; totalPages: number; goToPage: (page: number) => void }>): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-full border border-borderSoft bg-surfaceAlt p-1">
      <motion.button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Halaman sebelumnya"
        whileHover={currentPage === 1 ? undefined : { scale: 1.15, x: -2 }}
        whileTap={currentPage === 1 ? undefined : { scale: 0.88 }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surface disabled:opacity-30"
      >
        ‹
      </motion.button>
      <span className="min-w-[2.5rem] text-center text-xs font-semibold text-textMuted">
        {currentPage}/{totalPages}
      </span>
      <motion.button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Halaman berikutnya"
        whileHover={currentPage === totalPages ? undefined : { scale: 1.15, x: 2 }}
        whileTap={currentPage === totalPages ? undefined : { scale: 0.88 }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surface disabled:opacity-30"
      >
        ›
      </motion.button>
    </div>
  );
}

function DataTableBody<T>({
  columns,
  pagedRows,
  getRowId,
  isLoading,
  errorMessage,
  currentPage,
  rowsPerPage,
}: Readonly<{
  columns: DataTableColumn<T>[];
  pagedRows: T[];
  getRowId: (row: T) => string;
  isLoading: boolean;
  errorMessage?: string;
  currentPage: number;
  rowsPerPage: number;
}>): React.JSX.Element {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={columns.length + 1} className="py-8 text-center text-textMuted">
          Memuat data...
        </td>
      </tr>
    );
  }
  if (errorMessage) {
    return (
      <tr>
        <td colSpan={columns.length + 1} className="py-8 text-center text-dangerText">
          {errorMessage}
        </td>
      </tr>
    );
  }
  if (pagedRows.length === 0) {
    return (
      <tr>
        <td colSpan={columns.length + 1} className="py-8 text-center text-textMuted">
          Tidak ada data yang cocok.
        </td>
      </tr>
    );
  }
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {pagedRows.map((row, index) => (
        <motion.tr
          key={getRowId(row)}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, delay: index * 0.03 }}
          className="border-b border-borderSoft transition-colors last:border-0 hover:bg-surfaceAlt"
        >
          <td className="py-3 pr-4 text-center text-textMuted">
            {(currentPage - 1) * rowsPerPage + index + 1}
          </td>
          {columns.map((column) => (
            <td key={column.key} className={`py-3 pr-4 text-text ${alignClass(column.align)}`}>
              {column.render(row)}
            </td>
          ))}
        </motion.tr>
      ))}
    </AnimatePresence>
  );
}

function matchesSearch<T>(row: T, term: string): boolean {
  if (!term) {
    return true;
  }
  const haystack = JSON.stringify(row).toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') {
    return 'text-right';
  }
  if (align === 'center') {
    return 'text-center';
  }
  return 'text-left';
}

export function DataTable<T>({
  title,
  description,
  columns,
  rows,
  getRowId,
  searchPlaceholder = 'Cari......',
  pageSize = 10,
  isLoading = false,
  errorMessage,
  toolbar,
  onRowAction,
  visibleActions,
  module,
  serverPagination,
}: DataTableProps<T>): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [clientPage, setClientPage] = useState(1);

  const filteredRows = useMemo(() => {
    if (serverPagination) return rows;
    return rows.filter((row) => matchesSearch(row, search));
  }, [rows, search, serverPagination]);

  const totalPages = serverPagination ? Math.max(1, serverPagination.totalPages) : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = serverPagination ? serverPagination.page : Math.min(clientPage, totalPages);
  const pagedRows = serverPagination ? filteredRows : filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(next: number): void {
    if (serverPagination) {
      serverPagination.onPageChange(Math.min(totalPages, Math.max(1, next)));
    } else {
      setClientPage(Math.min(totalPages, Math.max(1, next)));
    }
  }

  function handleSearchChange(value: string): void {
    setSearch(value);
    setClientPage(1);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {description ? <p className="text-xs text-textMuted">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {serverPagination ? <LimitSelect serverPagination={serverPagination} /> : null}
          {serverPagination ? null : (
            <div className="relative w-full sm:w-56">
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full rounded-full border border-borderSoft bg-surfaceAlt px-4 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}
          <CompactPager currentPage={currentPage} totalPages={totalPages} goToPage={goToPage} />
        </div>
      </div>

      <TableRowActionBar onAction={onRowAction} visibleActions={visibleActions} module={module} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-borderSoft text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="w-12 py-3 pr-4 text-center font-semibold">No.</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`py-3 pr-4 font-semibold ${alignClass(column.align)}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <DataTableBody
              columns={columns}
              pagedRows={pagedRows}
              getRowId={getRowId}
              isLoading={isLoading}
              errorMessage={errorMessage}
              currentPage={currentPage}
              rowsPerPage={serverPagination?.limit ?? pageSize}
            />
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1">
        <motion.button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Halaman sebelumnya"
          whileHover={currentPage === 1 ? undefined : { scale: 1.12, x: -2 }}
          whileTap={currentPage === 1 ? undefined : { scale: 0.9 }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surfaceAlt disabled:opacity-30"
        >
          ‹
        </motion.button>
        <PageNumberButtons currentPage={currentPage} totalPages={totalPages} tableTitle={title} goToPage={goToPage} />
        <motion.button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Halaman berikutnya"
          whileHover={currentPage === totalPages ? undefined : { scale: 1.12, x: 2 }}
          whileTap={currentPage === totalPages ? undefined : { scale: 0.9 }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surfaceAlt disabled:opacity-30"
        >
          ›
        </motion.button>
      </div>
    </Card>
  );
}
