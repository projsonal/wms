// Utility dipakai bareng useExportFormat: memungkinkan menu manapun yang
// punya data bertanggal (transaksi, riwayat, dsb) dicetak/diexport dengan
// granularitas "Harian" (baris asli, tanggal lengkap tanggal-bulan-tahun)
// atau "Bulanan" (baris dikelompokkan per bulan, label "Agustus 2026").
import type { ExportColumn } from '@/lib/utils/export-csv';

export type ExportGranularity = 'harian' | 'bulanan';

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// formatTanggalPanjang: "1 September 2026" — dipakai untuk tampilan Harian.
export function formatTanggalPanjang(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '-';
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// formatBulanTahun: "Agustus 2026" — dipakai untuk tampilan Bulanan.
export function formatBulanTahun(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '-';
  return `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function monthSortKey(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '0000-00';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type PlainRow = Record<string, string | number>;

export interface GranularityConfig<T> {
  // Ambil nilai tanggal mentah (ISO string) dari 1 baris data.
  dateAccessor: (row: T) => string | null | undefined;
  // Header kolom (harus sama persis dengan salah satu ExportColumn.header)
  // yang nilainya numerik dan boleh DIJUMLAHKAN saat dikelompokkan per bulan.
  sumHeaders: string[];
  // Opsional: header kolom yang jadi kunci pengelompokan tambahan di dalam
  // 1 bulan (mis. "Kode Barang") — kalau diisi, 1 bulan bisa punya beberapa
  // baris (1 per nilai unik kolom ini). Kalau dikosongkan, 1 bulan = 1 baris
  // total gabungan.
  groupKeyHeader?: string;
}

// applyGranularity: kembalikan rows+columns siap dikirim ke exportRowsToPdf
// /exportRowsToExcel — untuk 'harian' cuma melewatkan data apa adanya
// (kolom tanggal aslinya sudah menampilkan tanggal lengkap lewat formatDate/
// formatTanggalPanjang di masing-masing halaman), untuk 'bulanan' baris
// dikelompokkan per bulan dengan kolom-kolom di sumHeaders dijumlahkan.
export function applyGranularity<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  granularity: ExportGranularity,
  config: GranularityConfig<T>,
): { rows: PlainRow[]; columns: ExportColumn<PlainRow>[] } {
  if (granularity === 'harian') {
    const plainRows = rows.map((row) => {
      const rec: PlainRow = {};
      columns.forEach((c) => {
        rec[c.header] = c.accessor(row);
      });
      return rec;
    });
    const plainColumns: ExportColumn<PlainRow>[] = columns.map((c) => ({
      header: c.header,
      accessor: (row) => row[c.header],
    }));
    return { rows: plainRows, columns: plainColumns };
  }

  const groupKeyHeader = config.groupKeyHeader;
  const buckets = new Map<
    string,
    { periode: string; sortKey: string; kelompok?: string; jumlahBaris: number; sums: Record<string, number> }
  >();

  rows.forEach((row) => {
    const tanggal = config.dateAccessor(row);
    const sortKey = monthSortKey(tanggal);
    const periode = formatBulanTahun(tanggal);
    const kelompokValue = groupKeyHeader
      ? String(columns.find((c) => c.header === groupKeyHeader)?.accessor(row) ?? '-')
      : undefined;
    const bucketKey = `${sortKey}::${kelompokValue ?? ''}`;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = { periode, sortKey, kelompok: kelompokValue, jumlahBaris: 0, sums: {} };
      config.sumHeaders.forEach((h) => {
        bucket!.sums[h] = 0;
      });
      buckets.set(bucketKey, bucket);
    }
    bucket.jumlahBaris += 1;
    config.sumHeaders.forEach((h) => {
      const col = columns.find((c) => c.header === h);
      const value = col ? col.accessor(row) : 0;
      bucket!.sums[h] += typeof value === 'number' ? value : Number(value) || 0;
    });
  });

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
    return (a.kelompok ?? '').localeCompare(b.kelompok ?? '');
  });

  const plainRows: PlainRow[] = sortedBuckets.map((bucket) => {
    const rec: PlainRow = { Periode: bucket.periode };
    if (groupKeyHeader) {
      rec[groupKeyHeader] = bucket.kelompok ?? '-';
    }
    rec['Jumlah Data'] = bucket.jumlahBaris;
    config.sumHeaders.forEach((h) => {
      rec[h] = bucket.sums[h];
    });
    return rec;
  });

  const plainColumns: ExportColumn<PlainRow>[] = [
    { header: 'Periode', accessor: (row) => row.Periode },
    ...(groupKeyHeader ? [{ header: groupKeyHeader, accessor: (row: PlainRow) => row[groupKeyHeader] }] : []),
    { header: 'Jumlah Data', accessor: (row) => row['Jumlah Data'] },
    ...config.sumHeaders.map((h) => ({ header: h, accessor: (row: PlainRow) => row[h] })),
  ];

  return { rows: plainRows, columns: plainColumns };
}
