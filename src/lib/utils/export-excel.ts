import * as XLSX from 'xlsx';
import type { ExportColumn } from '@/lib/utils/export-csv';

export function exportRowsToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Data',
): void {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) => columns.map((c) => c.accessor(row)));

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);

  worksheet['!cols'] = columns.map((col, i) => {
    const headerLen = col.header.length;
    const maxBodyLen = body.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), 0);
    return { wch: Math.min(60, Math.max(10, headerLen, maxBodyLen) + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
