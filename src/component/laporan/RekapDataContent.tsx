'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Button } from '@/component/ui/Button';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { useAuth } from '@/auth/AuthContext';
import { dashboardApi, pengajuanApi } from '@/lib/api/modules';
import { listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import type { TrendPoint } from '@/types';

interface RekapRow {
  kategori: string;
  item: string;
  nilai: string;
}

export function RekapDataContent(): React.JSX.Element {
  const { user } = useAuth();
  const { data: summary, error: summaryError, isLoading: summaryLoading } = useSWR(
    'rekap-data-summary',
    () => dashboardApi.summary(),
    { revalidateOnFocus: false },
  );
  const { data: trendRaw, error: trendError } = useSWR(
    'rekap-data-trend',
    () => dashboardApi.trend(),
    { revalidateOnFocus: false },
  );
  const { data: pengajuanSummary, error: pengajuanError } = useSWR(
    'rekap-data-pengajuan-summary',
    () => pengajuanApi.summary(),
    { revalidateOnFocus: false },
  );

  const trend: TrendPoint[] =
    !trendError && Array.isArray(trendRaw)
      ? trendRaw.map((point) => ({ label: point.bulan, value: point.masuk, secondaryValue: point.keluar }))
      : [];

  function buildRows(): RekapRow[] {
    if (!summary) return [];
    return [
      { kategori: 'Kelola Barang', item: 'Total SKU terdaftar', nilai: formatNumber(summary.kelolaBarang.totalBarang) },
      { kategori: 'Kelola Barang', item: 'Stok menipis', nilai: formatNumber(summary.kelolaBarang.stokMenipis) },
      { kategori: 'Kelola Barang', item: 'Total nilai inventaris', nilai: formatCurrency(summary.kelolaBarang.totalNilaiInventaris) },
      { kategori: 'Gudang', item: 'Total gudang', nilai: formatNumber(summary.gudang.totalGudang) },
      { kategori: 'Barang Masuk', item: 'Draft', nilai: formatNumber(summary.barangMasuk.draft) },
      { kategori: 'Barang Masuk', item: 'Selesai', nilai: formatNumber(summary.barangMasuk.selesai) },
      { kategori: 'Barang Keluar', item: 'Draft', nilai: formatNumber(summary.barangKeluar.draft) },
      { kategori: 'Barang Keluar', item: 'Selesai', nilai: formatNumber(summary.barangKeluar.selesai) },
      { kategori: 'Stock Opname', item: 'Draft', nilai: formatNumber(summary.stockOpname.draft) },
      { kategori: 'Stock Opname', item: 'Selesai', nilai: formatNumber(summary.stockOpname.selesai) },
      ...(pengajuanSummary && !pengajuanError
        ? [
            { kategori: 'Pengajuan Barang', item: 'Menunggu Persetujuan', nilai: formatNumber(pengajuanSummary.totalDiajukan) },
            { kategori: 'Pengajuan Barang', item: 'Disetujui', nilai: formatNumber(pengajuanSummary.totalDisetujui) },
            { kategori: 'Pengajuan Barang', item: 'Ditolak', nilai: formatNumber(pengajuanSummary.totalDitolak) },
          ]
        : []),
    ];
  }

  function handlePrint(): void {
    printRowsToPdf(
      buildRows(),
      [
        { header: 'Kategori', accessor: (r: RekapRow) => r.kategori },
        { header: 'Item', accessor: (r: RekapRow) => r.item },
        { header: 'Nilai', accessor: (r: RekapRow) => r.nilai },
      ],
      {
        title: 'Rekap Data Lengkap',
        subtitle: 'Laporan / Rekap Data',
        description:
          'Ringkasan operasional gudang lintas modul (Kelola Barang, Gudang, Barang Masuk/Keluar, Pengajuan Barang, Stock Opname) per tanggal cetak.',
        generatedBy: user?.fullName,
        fileName: 'data rekap lengkap',
      },
    );
  }

  const groups = Array.from(new Set(buildRows().map((r) => r.kategori)));

  let summaryContent: React.JSX.Element;
  if (summaryError) {
    summaryContent = (
      <Card>
        <p className="text-sm text-dangerText">{listErrorMessage(summaryError)}</p>
      </Card>
    );
  } else if (summaryLoading || !summary) {
    summaryContent = (
      <Card>
        <p className="text-sm text-textMuted">Memuat rekap data...</p>
      </Card>
    );
  } else {
    summaryContent = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((kategori) => (
          <Card key={kategori} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-text">{kategori}</h2>
            <ul className="flex flex-col gap-2 text-xs">
              {buildRows()
                .filter((r) => r.kategori === kategori)
                .map((r) => (
                  <li
                    key={r.item}
                    className="flex items-center justify-between border-b border-dashed border-borderSoft pb-1.5 last:border-b-0 last:pb-0"
                  >
                    <span className="text-textMuted">{r.item}</span>
                    <span className="font-semibold text-text">{r.nilai}</span>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Rekap Data" breadcrumb="Laporan / Rekap Data">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-textMuted">
          Ringkasan lengkap seluruh modul operasional gudang, sumber datanya sama persis dengan
          widget &quot;Rekap Data&quot; di dashboard halaman ini cuma menampilkannya lebih rinci.
        </p>
        <Button variant="secondary" onClick={handlePrint} disabled={!summary}>
          Cetak Rekap
        </Button>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-text">Rekap per Hari / per Bulan</h2>
        <p className="text-xs text-textMuted">
          Ringkasan di halaman ini adalah cuplikan kondisi terkini. Untuk rekap transaksi yang bisa
          dikelompokkan per hari atau per bulan (dengan grafik & bisa diekspor Excel/PDF/Word), buka
          salah satu laporan detail berikut:
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/barang-masuk" className="text-xs font-semibold text-accentDark hover:underline">
            Laporan Barang Masuk →
          </Link>
          <Link href="/reports/barang-keluar" className="text-xs font-semibold text-accentDark hover:underline">
            Laporan Barang Keluar →
          </Link>
          <Link href="/reports/pengajuan-barang" className="text-xs font-semibold text-accentDark hover:underline">
            Laporan Pengajuan Barang →
          </Link>
          <Link href="/reports/inventory" className="text-xs font-semibold text-accentDark hover:underline">
            Laporan Stok & Nilai Inventaris →
          </Link>
        </div>
      </Card>

      <TrendChartCard
        title="Tren Barang Masuk & Keluar"
        subtitle="6 bulan terakhir"
        data={trend}
        primaryLabel="Barang Masuk"
        secondaryLabel="Barang Keluar"
        errorMessage={listErrorMessage(trendError)}
      />

      {summaryContent}
    </PageShell>
  );
}