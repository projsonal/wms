'use client';

import useSWR from 'swr';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Button } from '@/component/ui/Button';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { useAuth } from '@/auth/AuthContext';
import { dashboardApi } from '@/lib/api/modules';
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
      { kategori: 'Gudang', item: 'Total rak', nilai: formatNumber(summary.gudang.totalRak) },
      { kategori: 'Gudang', item: 'Rak penuh', nilai: formatNumber(summary.gudang.rakPenuh) },
      { kategori: 'Gudang', item: 'Rak kosong', nilai: formatNumber(summary.gudang.rakKosong) },
      { kategori: 'Supplier', item: 'Total supplier', nilai: formatNumber(summary.supplier.totalSupplier) },
      { kategori: 'Supplier', item: 'Supplier aktif', nilai: formatNumber(summary.supplier.supplierAktif) },
      { kategori: 'Purchase Order', item: 'Total PO', nilai: formatNumber(summary.purchaseOrder.totalPo) },
      { kategori: 'Purchase Order', item: 'Menunggu persetujuan', nilai: formatNumber(summary.purchaseOrder.menungguPersetujuan) },
      { kategori: 'Purchase Order', item: 'Disetujui', nilai: formatNumber(summary.purchaseOrder.disetujui) },
      { kategori: 'Barang Masuk', item: 'Draft', nilai: formatNumber(summary.barangMasuk.draft) },
      { kategori: 'Barang Masuk', item: 'Selesai', nilai: formatNumber(summary.barangMasuk.selesai) },
      { kategori: 'Barang Keluar', item: 'Draft', nilai: formatNumber(summary.barangKeluar.draft) },
      { kategori: 'Barang Keluar', item: 'Selesai', nilai: formatNumber(summary.barangKeluar.selesai) },
      { kategori: 'Stock Opname', item: 'Draft', nilai: formatNumber(summary.stockOpname.draft) },
      { kategori: 'Stock Opname', item: 'Selesai', nilai: formatNumber(summary.stockOpname.selesai) },
      { kategori: 'Pengiriman', item: 'Dalam perjalanan', nilai: formatNumber(summary.pengiriman.dalamPerjalanan) },
      { kategori: 'Pengiriman', item: 'Terkirim', nilai: formatNumber(summary.pengiriman.terkirim) },
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
        title: 'Rekap Data Gudang — Rekap Data Lengkap',
        subtitle: 'Laporan / Rekap Data',
        description:
          'Ringkasan operasional gudang lintas modul (Kelola Barang, Gudang, Supplier, Purchase Order, Barang Masuk/Keluar, Stock Opname, Pengiriman) per tanggal cetak.',
        generatedBy: user?.fullName,
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
          widget &quot;Rekap Data&quot; di dashboard — halaman ini cuma menampilkannya lebih rinci.
        </p>
        <Button variant="secondary" onClick={handlePrint} disabled={!summary}>
          Cetak Rekap
        </Button>
      </div>

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