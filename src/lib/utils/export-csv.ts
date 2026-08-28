export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export function exportRowsToCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string): void {
  const escape = (value: string | number): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.accessor(row))).join(','));
  const csv = [header, ...body].join('\r\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
