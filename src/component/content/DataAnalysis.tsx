'use client';

import useSWR from 'swr';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { StatsRow } from '@/component/ui/StatsRow';
import { DonutChartCard } from '@/component/charts/DonutChartCard';
import { dashboardApi } from '@/lib/api/modules';
import { formatNumber } from '@/lib/utils/format';
import { JENIS_ASET_META, ASSET_STATUS_META } from '@/lib/utils/status';

const DONUT_COLORS = ['#b3471f', '#3454c7', '#c9791e', '#8a7b74', '#2f8132', '#6b5d56'];
const STATUS_DONUT_COLORS: Record<string, string> = {
  aktif: '#2f8132',
  rusak: '#c0392b',
  nonaktif: '#8a7b74',
};

function RankingCard({
  title,
  items,
  unit,
}: Readonly<{
  title: string;
  items: Array<{ name: string; value: number }>;
  unit: string;
}>): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-textMuted">Belum ada data transaksi selesai untuk dianalisis.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.name} className="flex items-center justify-between text-sm">
              <span className="text-text">
                <span className="mr-2 text-textMuted">{index + 1}.</span>
                {item.name}
              </span>
              <span className="text-right text-xs text-textMuted">
                {formatNumber(item.value)} {unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BreakdownList({
  title,
  items,
  emptyMessage,
}: Readonly<{
  title: string;
  items: Array<{ label: string; value: number }>;
  emptyMessage: string;
}>): React.JSX.Element {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-textMuted">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate text-text">{item.label}</span>
              <span className="w-24 text-right text-xs text-textMuted">
                {formatNumber(item.value)} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DataAnalysisContent(): React.JSX.Element {
  const { data, isLoading } = useSWR('dashboard-analisa', () => dashboardApi.analisa());

  const kategoriData = (data?.kategoriComposition ?? []).map((k, i) => ({
    label: k.label,
    value: k.value,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const asetJenisData = (data?.asetPerJenis ?? []).map((a, i) => ({
    label: JENIS_ASET_META[a.label]?.label ?? a.label,
    value: a.value,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const asetStatusData = (data?.asetPerStatus ?? []).map((a) => ({
    label: ASSET_STATUS_META[a.label as keyof typeof ASSET_STATUS_META]?.label ?? a.label,
    value: a.value,
    color: STATUS_DONUT_COLORS[a.label] ?? '#8a7b74',
  }));

  return (
    <PageShell title="Analisa Data" breadcrumb="Pengiriman / Analisa Data">
      <StatsRow
        stats={[
          { id: 'sku', label: 'SKU Dianalisis', value: isLoading ? '-' : formatNumber(data?.totalSku ?? 0) },
          {
            id: 'restock',
            label: 'Total Restock Bulan Ini',
            value: isLoading ? '-' : formatNumber(data?.totalRestockBulanIni ?? 0),
          },
          {
            id: 'menipis',
            label: 'Barang Stok Menipis',
            value: isLoading ? '-' : formatNumber(data?.stokMenipis ?? 0),
          },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
        <DonutChartCard
          title="Komposisi Kategori Barang"
          subtitle="Berdasarkan jumlah SKU"
          data={kategoriData}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RankingCard title="Barang Paling Sering Direstok" items={data?.topRestocked ?? []} unit="unit masuk" />
          <RankingCard title="Barang Paling Sering Keluar" items={data?.topKeluar ?? []} unit="unit keluar" />
        </div>
      </div>

      <div className="mt-2">
        <h2 className="mb-3 text-base font-semibold text-text">Analisa Aset Perusahaan</h2>
        <StatsRow
          stats={[
            { id: 'total-aset', label: 'Total Aset', value: isLoading ? '-' : formatNumber(data?.totalAset ?? 0) },
            {
              id: 'aset-rusak',
              label: 'Aset Berstatus Rusak',
              value: isLoading ? '-' : formatNumber(data?.asetRusak ?? 0),
            },
          ]}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DonutChartCard
            title="Komposisi Jenis Aset"
            subtitle="Tiang / ODC / ONT / ODP / OLT / Transportasi"
            data={asetJenisData}
          />
          <DonutChartCard
            title="Kondisi Aset"
            subtitle="Aktif / Rusak / Nonaktif"
            data={asetStatusData}
          />
          <BreakdownList
            title="Aset per Gudang"
            items={data?.asetPerGudang ?? []}
            emptyMessage="Belum ada aset yang tercatat di gudang mana pun."
          />
        </div>
      </div>
    </PageShell>
  );
}
