'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/component/ui/Badge';
import { StatCard } from '@/component/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { RecentActivityCard, type ActivityItem } from '@/component/roles_dashboard/RecentActivityCard';
import { DeliveryTrackingCard } from '@/component/roles_dashboard/DeliveryTrackingCard';
import { Card } from '@/component/ui/Card';
import { Reveal } from '@/component/ui/Reveal';
import { dashboardApi, deliveriesApi, goodsInApi, goodsOutApi } from '@/lib/api/modules';
import type { RawBarangKeluar, RawBarangMasuk, DraftDocumentStatus, BarangMasukStatus } from '@/lib/api/raw-types';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { listErrorMessage } from '@/lib/utils/errors';
import { formatDate, formatNumber, formatCurrency } from '@/lib/utils/format';
import type { StatMetric, TrendPoint, UserRole } from '@/types';

interface TransactionRow {
  id: string;
  date: string;
  code: string;
  type: 'Masuk' | 'Keluar';
  itemName: string;
  quantity: string;
  status: 'Selesai' | 'Proses' | 'Dibatalkan';
}

function statusLabel(status: DraftDocumentStatus | BarangMasukStatus): TransactionRow['status'] {
  const normalized = status.toLowerCase();
  if (normalized === 'selesai') return 'Selesai';
  if (normalized === 'dibatalkan') return 'Dibatalkan';
  return 'Proses';
}

function statusVariant(status: TransactionRow['status']): 'success' | 'warning' | 'danger' {
  if (status === 'Selesai') return 'success';
  if (status === 'Dibatalkan') return 'danger';
  return 'warning';
}

/** Pecah satu dokumen barang masuk/keluar (header + banyak item) jadi
 * satu baris tabel per item, supaya bentuknya sama dengan tabel transaksi
 * di mockup (satu baris = satu nama barang + jumlah). */
function flattenMasuk(docs: RawBarangMasuk[]): TransactionRow[] {
  return docs.flatMap((doc) =>
    (doc.items ?? []).map((item, idx) => ({
      id: `bm-${doc.id}-${item.id ?? idx}`,
      date: doc.tanggal,
      code: doc.nomorPenerimaan,
      type: 'Masuk' as const,
      itemName: item.barang?.nama ?? `Barang #${item.barangId}`,
      quantity: `${formatNumber(item.qty)} ${item.barang?.satuan?.nama ?? ''}`.trim(),
      status: statusLabel(doc.status),
    })),
  );
}

function flattenKeluar(docs: RawBarangKeluar[]): TransactionRow[] {
  return docs.flatMap((doc) =>
    (doc.items ?? []).map((item, idx) => ({
      id: `bk-${doc.id}-${item.id ?? idx}`,
      date: doc.tanggal,
      code: doc.nomorPengeluaran,
      type: 'Keluar' as const,
      itemName: item.barang?.nama ?? `Barang #${item.barangId}`,
      quantity: `${formatNumber(item.qty)} ${item.barang?.satuan?.nama ?? ''}`.trim(),
      status: statusLabel(doc.status),
    })),
  );
}

const transactionColumns: DataTableColumn<TransactionRow>[] = [
  { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.date) },
  { key: 'code', header: 'Kode', render: (row) => row.code },
  {
    key: 'type',
    header: 'Jenis',
    render: (row) => <Badge label={row.type} variant={row.type === 'Masuk' ? 'info' : 'warning'} />,
  },
  { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
  { key: 'quantity', header: 'Jumlah', render: (row) => row.quantity },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge label={row.status} variant={statusVariant(row.status)} />,
  },
];

interface StaffDashboardBaseProps {
  readonly role: Extract<UserRole, 'super_admin' | 'admin'>;
}

export function StaffDashboardBase({ role }: StaffDashboardBaseProps): React.JSX.Element {
  const { user } = useAuth();
  const { requestExport, dialog: exportDialog } = useExportFormat();
  const { data: summaryRaw, error: summaryError } = useSWR(
    'dashboard-summary',
    () => dashboardApi.summary(),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const { data: trendRaw, error: trendError } = useSWR(
    'dashboard-trend',
    () => dashboardApi.trend(),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const {
    data: activities,
    error: activitiesError,
    isLoading: activitiesLoading,
  } = useSWR<ActivityItem[]>('dashboard-activity', () => dashboardApi.activity(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const stats: StatMetric[] | null =
    !summaryError && summaryRaw
      ? [
          { id: 'total-barang', label: 'Total Barang', value: String(summaryRaw.kelolaBarang.totalBarang) },
          { id: 'stok-menipis', label: 'Stok Menipis', value: String(summaryRaw.kelolaBarang.stokMenipis) },
          { id: 'po-menunggu', label: 'PO Menunggu Persetujuan', value: String(summaryRaw.purchaseOrder.menungguPersetujuan) },
          ...(role === 'super_admin'
            ? [{ id: 'rak-penuh', label: 'Rak Penuh', value: String(summaryRaw.gudang.rakPenuh) }]
            : []),
        ]
      : null;

  const trend: TrendPoint[] =
    !trendError && Array.isArray(trendRaw)
      ? trendRaw.map((point) => ({ label: point.bulan, value: point.masuk, secondaryValue: point.keluar }))
      : [];

  const { data: deliveriesResult, error: deliveriesError } = useSWR(
    'dashboard-deliveries-preview',
    () => deliveriesApi.list({ pageSize: 3 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const deliveries = deliveriesResult?.data ?? [];

  // Table List: gabungan 5 dokumen barang masuk + 5 dokumen barang keluar
  // terbaru, dipecah per item baris. Read-only (lihat visibleActions di
  // bawah) — backend tidak punya satu endpoint gabungan untuk resource ini,
  // dan Add/Edit terpadu tidak masuk akal untuk dua jenis dokumen dengan
  // field berbeda. Untuk tambah/ubah/hapus transaksi sungguhan, gunakan
  // halaman Barang Masuk / Barang Keluar masing-masing.
  const { data: goodsInResult, error: goodsInError, isLoading: goodsInLoading } = useSWR(
    'dashboard-table-goods-in',
    () => goodsInApi.list({ page: 1, pageSize: 5 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const { data: goodsOutResult, error: goodsOutError, isLoading: goodsOutLoading } = useSWR(
    'dashboard-table-goods-out',
    () => goodsOutApi.list({ page: 1, pageSize: 5 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const transactionRows: TransactionRow[] = [
    ...flattenMasuk(goodsInResult?.data ?? []),
    ...flattenKeluar(goodsOutResult?.data ?? []),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const TRANSACTION_EXPORT_COLUMNS = [
    { header: 'Tanggal', accessor: (row: TransactionRow) => formatDate(row.date) },
    { header: 'Kode', accessor: (row: TransactionRow) => row.code },
    { header: 'Jenis', accessor: (row: TransactionRow) => row.type },
    { header: 'Nama Barang', accessor: (row: TransactionRow) => row.itemName },
    { header: 'Jumlah', accessor: (row: TransactionRow) => row.quantity },
    { header: 'Status', accessor: (row: TransactionRow) => row.status },
  ];
  const TRANSACTION_PDF_META = {
    title: 'Rekap Data Gudang — Transaksi Terbaru',
    subtitle: 'Dashboard',
    description: 'Gabungan transaksi barang masuk & keluar terbaru pada gudang, beserta jumlah dan status prosesnya.',
  };

  function handleExportTransactions(): void {
    requestExport(transactionRows, TRANSACTION_EXPORT_COLUMNS, 'transaksi-terbaru', TRANSACTION_PDF_META);
  }

  function handlePrintTransactions(): void {
    printRowsToPdf(transactionRows, TRANSACTION_EXPORT_COLUMNS, {
      ...TRANSACTION_PDF_META,
      generatedBy: user?.fullName,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-[2fr_1fr_1fr]">
        <Reveal index={0}>
          <TrendChartCard
            title="Tren Barang Masuk &amp; Keluar"
            subtitle="6 bulan terakhir"
            data={trend}
            primaryLabel="Barang Masuk"
            secondaryLabel="Barang Keluar"
            errorMessage={listErrorMessage(trendError)}
          />
        </Reveal>
        <Reveal index={1}>
          {activitiesLoading ? (
            <Card className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-text">Aktivitas Terbaru</h2>
              <p className="text-xs text-textMuted">Memuat...</p>
            </Card>
          ) : (
            <RecentActivityCard items={activities ?? []} errorMessage={listErrorMessage(activitiesError)} />
          )}
        </Reveal>
        <Reveal index={2}>
          <DeliveryTrackingCard deliveries={deliveries} errorMessage={listErrorMessage(deliveriesError)} />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <Reveal index={0}>
          <DataTable
            title="Table List"
            description="Transaksi barang masuk & keluar terbaru"
            columns={transactionColumns}
            rows={transactionRows}
            getRowId={(row) => row.id}
            isLoading={goodsInLoading || goodsOutLoading}
            errorMessage={listErrorMessage(goodsInError ?? goodsOutError)}
            visibleActions={['export', 'print']}
            onRowAction={(action) => {
              if (action === 'export') handleExportTransactions();
              if (action === 'print') handlePrintTransactions();
            }}
          />
        </Reveal>
        <div className="flex flex-col gap-4">
          <Reveal index={1}>
            <Card className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">Traffic Pengiriman</h2>
                <p className="text-xs text-textMuted">Dokumen Barang Masuk & Keluar per status</p>
              </div>
              {summaryError || !summaryRaw ? (
                <p className="text-xs text-textMuted">
                  {summaryError ? listErrorMessage(summaryError) : 'Memuat...'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-borderSoft p-3">
                    <p className="text-[10px] uppercase tracking-wide text-textMuted">Barang Masuk</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-successText">
                        {summaryRaw.barangMasuk.selesai}
                      </span>
                      <span className="text-[10px] text-textMuted">selesai</span>
                    </div>
                    <p className="text-[10px] text-textMuted">{summaryRaw.barangMasuk.draft} draft</p>
                  </div>
                  <div className="rounded-md border border-borderSoft p-3">
                    <p className="text-[10px] uppercase tracking-wide text-textMuted">Barang Keluar</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-warningText">
                        {summaryRaw.barangKeluar.selesai}
                      </span>
                      <span className="text-[10px] text-textMuted">selesai</span>
                    </div>
                    <p className="text-[10px] text-textMuted">{summaryRaw.barangKeluar.draft} draft</p>
                  </div>
                </div>
              )}
            </Card>
          </Reveal>
          <Reveal index={2}>
            <Card className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">Rekap Data</h2>
                <p className="text-xs text-textMuted">Ringkasan operasional gudang saat ini</p>
              </div>
              {summaryError || !summaryRaw ? (
                <p className="text-xs text-textMuted">
                  {summaryError ? listErrorMessage(summaryError) : 'Memuat...'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-xs">
                  <li className="flex items-center justify-between border-b border-dashed border-borderSoft pb-1.5">
                    <span className="text-textMuted">Total SKU terdaftar</span>
                    <span className="font-semibold text-text">{summaryRaw.kelolaBarang.totalBarang}</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-dashed border-borderSoft pb-1.5">
                    <span className="text-textMuted">Total nilai inventaris</span>
                    <span className="font-semibold text-text">
                      {formatCurrency(summaryRaw.kelolaBarang.totalNilaiInventaris)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between border-b border-dashed border-borderSoft pb-1.5">
                    <span className="text-textMuted">Stock Opname selesai</span>
                    <span className="font-semibold text-text">{summaryRaw.stockOpname.selesai}</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-dashed border-borderSoft pb-1.5">
                    <span className="text-textMuted">Pengiriman dalam perjalanan</span>
                    <span className="font-semibold text-text">{summaryRaw.pengiriman.dalamPerjalanan}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-textMuted">Pengiriman terkirim</span>
                    <span className="font-semibold text-text">{summaryRaw.pengiriman.terkirim}</span>
                  </li>
                </ul>
              )}
              <Link
                href="/home/reports/inventory"
                className="text-right text-xs font-semibold text-accent hover:underline"
              >
                Lihat laporan lengkap
              </Link>
            </Card>
          </Reveal>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats === null ? (
          <p className="col-span-full text-xs text-dangerText">
            {listErrorMessage(summaryError)}
          </p>
        ) : (
          stats.map((stat, index) => (
            <StatCard key={stat.id} index={index} label={stat.label} value={stat.value} />
          ))
        )}
      </div>
      {exportDialog}
    </div>
  );
}

