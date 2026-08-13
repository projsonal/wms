'use client';

import useSWR from 'swr';
import { PageShell } from '@/component/layout/PageShell';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { ReportDownloadButton } from '@/component/laporan/ReportDownloadButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { laporanApi } from '@/lib/api/modules';
import { printRowsToPdf } from '@/lib/utils/export-pdf';

interface ReportPageTemplateProps {
  title: string;
  breadcrumb: string;
  /** Nilai `tipe` yang dikenali backend (GET /laporan/export|preview?tipe=...) —
   * lihat reportTitles di internal/controller/laporan/laporan_controller.go.
   * Backend HANYA punya 5 tipe: "Stok Barang", "Barng Masuk" (typo asli
   * di backend, sengaja disamakan persis), "Barang Keluar",
   * "Purchase Order", "Stock Opname". Kalau undefined, halaman menampilkan
   * pesan jujur "belum ada data" daripada data karangan. */
  reportType?: string;
}

/** Baris generik {header: value} — backend mengirim headers[]+rows[][]
 * yang bentuknya beda-beda tiap tipe laporan, jadi tabelnya dibangun
 * dinamis dari situ, bukan kolom tetap seperti versi dummy sebelumnya. */
function toGenericRows(headers: string[], rows: string[][]): Array<Record<string, string> & { _id: string }> {
  return rows.map((row, idx) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return { ...obj, _id: String(idx) };
  });
}

export function ReportPageTemplate({ title, breadcrumb, reportType }: ReportPageTemplateProps): React.JSX.Element {
  const { user } = useAuth();
  const { data, isLoading } = useSWR(
    reportType ? ['laporan-preview', reportType] : null,
    () => laporanApi.preview(reportType as string),
  );

  const headers = data?.headers ?? [];
  const genericRows = toGenericRows(headers, data?.rows ?? []);
  const columns: DataTableColumn<(typeof genericRows)[number]>[] = headers.map((h) => ({
    key: h,
    header: h,
    render: (row) => row[h] ?? '-',
  }));

  function handlePrint(): void {
    printRowsToPdf(
      genericRows,
      headers.map((h) => ({ header: h, accessor: (row: (typeof genericRows)[number]) => row[h] ?? '-' })),
      {
        title: `Rekap Data Gudang — ${title}`,
        subtitle: breadcrumb,
        description: `Rincian data laporan "${title}" langsung dari database, sesuai periode berjalan.`,
        generatedBy: user?.fullName,
      },
    );
  }

  return (
    <PageShell
      title={title}
      breadcrumb={breadcrumb}
      action={reportType ? <ReportDownloadButton reportType={reportType} /> : undefined}
    >
      {reportType ? (
        <>
          <StatsRow
            stats={(data?.summary ?? []).map((s, i) => ({
              id: String(i),
              label: s.label,
              value: s.value,
            }))}
          />
          <DataTable
            title="Rincian Laporan"
            description="Detail transaksi dari database, sesuai periode berjalan"
            columns={columns}
            rows={genericRows}
            getRowId={(row) => row._id}
            isLoading={isLoading}
            // Laporan bersifat read-only (sudah ada tombol "Unduh Laporan"
            // di header) — Add/Change/Delete/Modify/Protect tidak relevan
            // untuk baris hasil agregasi laporan. Print tetap diaktifkan
            // untuk super admin (rekap PDF A4 langsung dari data yang
            // tampil, terpisah dari tombol "Unduh Laporan" bawaan).
            visibleActions={['print']}
            onRowAction={(action) => {
              if (action === 'print') handlePrint();
            }}
          />
        </>
      ) : (
        <div className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-8 text-center text-sm text-textMuted">
          Laporan ini belum punya sumber data di backend (belum ada modul retur di database), jadi
          sengaja tidak ditampilkan data karangan di sini. Hubungi tim pengembang kalau modul ini
          perlu dibuatkan.
        </div>
      )}
    </PageShell>
  );
}
