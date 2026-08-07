'use client';

import useSWR from 'swr';
import { Badge } from '@/component/ui/Badge';
import { StatCard } from '@/component/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { ProgressListCard } from '@/component/charts/ProgressListCard';
import { RecentActivityCard } from '@/component/roles_dashboard/RecentActivityCard';
import { DeliveryTrackingCard } from '@/component/roles_dashboard/DeliveryTrackingCard';
import { Card } from '@/component/ui/Card';
import { Reveal } from '@/component/ui/Reveal';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi, deliveriesApi } from '@/lib/api/modules';
import {
  SEED_ACTIVITIES,
  SEED_DASHBOARD_STATS,
  SEED_DELIVERIES,
  SEED_TRAFFIC,
  SEED_TRANSACTIONS,
  SEED_TREND_IN_OUT,
  type StockTransactionRow,
} from '@/lib/data/sample-data';
import type { StatMetric, TrendPoint, UserRole } from '@/types';

const transactionColumns: DataTableColumn<StockTransactionRow>[] = [
  { key: 'date', header: 'Tanggal', render: (row) => row.date },
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
    render: (row) => (
      <Badge label={row.status} variant={row.status === 'Selesai' ? 'success' : 'warning'} />
    ),
  },
];

interface StaffDashboardBaseProps {
  readonly role: Extract<UserRole, 'super_admin' | 'admin'>;
}


export function StaffDashboardBase({ role }: StaffDashboardBaseProps): React.JSX.Element {
  const fallbackStats =
    role === 'super_admin'
      ? SEED_DASHBOARD_STATS
      : SEED_DASHBOARD_STATS.filter((stat) => stat.id !== 'akurasi');

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

  const stats: StatMetric[] =
    !summaryError && summaryRaw
      ? [
          { id: 'total-barang', label: 'Total Barang', value: String(summaryRaw.kelolaBarang.totalBarang) },
          { id: 'stok-menipis', label: 'Stok Menipis', value: String(summaryRaw.kelolaBarang.stokMenipis) },
          { id: 'po-menunggu', label: 'PO Menunggu Persetujuan', value: String(summaryRaw.purchaseOrder.menungguPersetujuan) },
          ...(role === 'super_admin'
            ? [{ id: 'rak-penuh', label: 'Rak Penuh', value: String(summaryRaw.gudang.rakPenuh) }]
            : []),
        ]
      : fallbackStats;

  const trend: TrendPoint[] =
    !trendError && Array.isArray(trendRaw)
      ? trendRaw.map((point) => ({ label: point.bulan, value: point.masuk, secondaryValue: point.keluar }))
      : SEED_TREND_IN_OUT;

  const { data: deliveriesResult, error: deliveriesError } = useSWR(
    'dashboard-deliveries-preview',
    () => deliveriesApi.list({ pageSize: 3 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const deliveries =
    !deliveriesError && Array.isArray(deliveriesResult?.data)
      ? deliveriesResult.data
      : SEED_DELIVERIES.slice(0, 3);

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
          />
        </Reveal>
        {/* Catatan: backend belum punya endpoint aktivitas-terbaru (mis.
            GET /dashboard/activities), jadi kartu ini masih data contoh. */}
        <Reveal index={1}>
          <RecentActivityCard items={SEED_ACTIVITIES} />
        </Reveal>
        <Reveal index={2}>
          <DeliveryTrackingCard deliveries={deliveries} />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        {/* Catatan: backend belum punya endpoint transaksi gabungan
            masuk/keluar (mis. GET /dashboard/transactions), jadi tabel ini
            masih data contoh. Begitu tersedia, ganti `rows` dengan
            useResourceList seperti pola di ItemsManagement.tsx. */}
        <Reveal index={0}>
          <DataTable
            title="Table List"
            description="Transaksi barang masuk & keluar terbaru"
            columns={transactionColumns}
            rows={SEED_TRANSACTIONS}
            getRowId={(row) => row.id}
          />
        </Reveal>
        <div className="flex flex-col gap-4">
          <Reveal index={1}>
            <Card className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-text">Traffic Penjualan</h2>
              <p className="text-xs text-textMuted">Berdasarkan pertahun</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={SEED_TRAFFIC} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#8a7b74' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#8a7b74' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #f0dad2', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3454c7"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Reveal>
          <Reveal index={2}>
            <ProgressListCard
              title="Rekap Data"
              subtitle="Barang masuk vs keluar"
              rows={[
                { label: 'Barang Masuk', value: '540 unit', percent: 80, color: '#b3471f' },
                { label: 'Barang Keluar', value: '486 unit', percent: 70, color: '#3454c7' },
                { label: 'Retur', value: '12 unit', percent: 8, color: '#c63c3c' },
              ]}
            />
          </Reveal>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.id}
            index={index}
            label={stat.label}
            value={stat.value}
            trend={{ value: '5,9%', positive: true }}
          />
        ))}
      </div>
    </div>
  );
}
