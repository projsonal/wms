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
  /** Kalau diisi, ditampilkan sebagai baris pesan error (menggantikan
   * "Tidak ada data yang cocok.") — dipakai saat fetch ke backend gagal,
   * supaya beda jelas dari kondisi tabel yang memang kosong. */
  errorMessage?: string;
  toolbar?: ReactNode;
  /** Dipanggil saat tombol Add/Change/Delete/Insert/Modify/Protect ditekan
   * (toolbar ini hanya tampil untuk role super_admin/admin — lihat
   * TableRowActionBar). Kalau tidak diisi, tombol tetap tampil tapi tidak
   * melakukan apa-apa; pemanggil per halaman yang menentukan aksinya. */
  onRowAction?: (action: TableRowAction) => void;
  /** Batasi tombol aksi yang muncul di toolbar (lihat TableRowActionBar).
   * Kalau tidak diisi, semua aksi baku tampil seperti biasa. */
  visibleActions?: TableRowAction[];
  /** Slug modul backend (mis. "kelola_barang") — kalau diisi, tombol
   * Add/Change/Modify/Print mengikuti matrix perizinan role user yang
   * login, bukan cuma role super_admin/admin. Lihat TableRowActionBar. */
  module?: string;
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
}: DataTableProps<T>): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, search));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleSearchChange(value: string): void {
    setSearch(value);
    setPage(1);
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
          <div className="relative w-full sm:w-56">
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-full border border-borderSoft bg-surfaceAlt px-4 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-borderSoft bg-surfaceAlt p-1">
            <motion.button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              aria-label="Halaman berikutnya"
              whileHover={currentPage === totalPages ? undefined : { scale: 1.15, x: 2 }}
              whileTap={currentPage === totalPages ? undefined : { scale: 0.88 }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surface disabled:opacity-30"
            >
              ›
            </motion.button>
          </div>
        </div>
      </div>

      {/* Toolbar aksi khusus super_admin/admin (Add/Change/Delete/Insert/
          Modify/Protect) — TableRowActionBar sendiri yang menentukan
          apakah tampil atau tidak berdasarkan role user login. */}
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
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-textMuted">
                  Memuat data...
                </td>
              </tr>
            ) : null}
            {!isLoading && errorMessage ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-dangerText">
                  {errorMessage}
                </td>
              </tr>
            ) : null}
            {!isLoading && !errorMessage && pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-textMuted">
                  Tidak ada data yang cocok.
                </td>
              </tr>
            ) : null}
            <AnimatePresence initial={false} mode="popLayout">
              {!isLoading &&
                !errorMessage &&
                pagedRows.map((row, index) => (
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
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`py-3 pr-4 text-text ${alignClass(column.align)}`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1">
        <motion.button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          aria-label="Halaman sebelumnya"
          whileHover={currentPage === 1 ? undefined : { scale: 1.12, x: -2 }}
          whileTap={currentPage === 1 ? undefined : { scale: 0.9 }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surfaceAlt disabled:opacity-30"
        >
          ‹
        </motion.button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <motion.button
            key={pageNumber}
            type="button"
            onClick={() => setPage(pageNumber)}
            aria-current={pageNumber === currentPage}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-textMuted transition-colors hover:bg-surfaceAlt"
          >
            {pageNumber === currentPage ? (
              <motion.span
                layoutId={`${title}-page-pill`}
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <span className={`relative z-10 ${pageNumber === currentPage ? 'text-white' : ''}`}>
              {pageNumber}
            </span>
          </motion.button>
        ))}
        <motion.button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
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
