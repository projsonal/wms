'use client';

import useSWR from 'swr';
import { StatCard } from '@/component/ui/StatCard';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { AttentionPanel } from '@/component/roles_dashboard/AttentionPanel';
import { Card } from '@/component/ui/Card';
import { Reveal } from '@/component/ui/Reveal';
import Link from 'next/link';
import { dashboardApi, itemsApi } from '@/lib/api/modules';
import { listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency } from '@/lib/utils/format';
import type { StatMetric, TrendPoint, UserRole } from '@/types';

interface StaffDashboardBaseProps {
  readonly role: Extract<UserRole, 'super_admin' | 'admin'>;
}

export function StaffDashboardBase({ role }: StaffDashboardBaseProps): React.JSX.Element {
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

  const stats: StatMetric[] | null =
    !summaryError && summaryRaw
      ? [
          { id: 'total-barang', label: 'Total Barang', value: String(summaryRaw.kelolaBarang.totalBarang) },
          { id: 'stok-menipis', label: 'Stok Menipis', value: String(summaryRaw.kelolaBarang.stokMenipis) },
          { id: 'bm-draft', label: 'Barang Masuk Draft', value: String(summaryRaw.barangMasuk.draft) },
          ...(role === 'super_admin'
            ? [{ id: 'total-gudang', label: 'Total Gudang', value: String(summaryRaw.gudang.totalGudang) }]
            : []),
        ]
      : null;

  const trend: TrendPoint[] =
    !trendError && Array.isArray(trendRaw)
      ? trendRaw.map((point) => ({ label: point.bulan, value: point.masuk, secondaryValue: point.keluar }))
      : [];

  const {
    data: lowStockResult,
    error: lowStockError,
    isLoading: lowStockLoading,
  } = useSWR(
    'dashboard-low-stock',
    () => itemsApi.list({ stok_menipis: 1, pageSize: 5 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <Reveal index={0}>
          <AttentionPanel
            lowStockItems={lowStockResult?.data ?? []}
            lowStockLoading={lowStockLoading}
            lowStockError={listErrorMessage(lowStockError)}
          />
        </Reveal>
        <div className="flex flex-col gap-4">
          <Reveal index={1}>
            <Card className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">Traffic Barang Masuk &amp; Keluar</h2>
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
                  <li className="flex items-center justify-between">
                    <span className="text-textMuted">Stock Opname selesai</span>
                    <span className="font-semibold text-text">{summaryRaw.stockOpname.selesai}</span>
                  </li>
                </ul>
              )}
              <Link
                href="/reports/rekap-data"
                className="text-right text-xs font-semibold text-accent hover:underline"
              >
                Lihat laporan lengkap
              </Link>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}