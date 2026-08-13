import * as XLSX from 'xlsx';
import type { ExportColumn } from '@/lib/utils/export-csv';

/**
 * Ekspor baris tabel apa pun ke file .xlsx asli (bukan CSV yang "dipaksa"
 * dibuka Excel) — kolom otomatis di-lebarkan mengikuti isi terpanjang
 * supaya tidak perlu resize manual saat dibuka.
 */
export function exportRowsToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Data',
): void {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) => columns.map((c) => c.accessor(row)));

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);

  // Lebar kolom otomatis: ambil karakter terpanjang antara header & isi,
  // dengan batas wajar (10–60 karakter) supaya tidak ada kolom super lebar
  // gara-gara satu nilai outlier (mis. deskripsi panjang).
  worksheet['!cols'] = columns.map((col, i) => {
    const headerLen = col.header.length;
    const maxBodyLen = body.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), 0);
    return { wch: Math.min(60, Math.max(10, headerLen, maxBodyLen) + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
