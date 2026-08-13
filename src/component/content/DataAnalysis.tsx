'use client';

import useSWR from 'swr';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { StatsRow } from '@/component/ui/StatsRow';
import { DonutChartCard } from '@/component/charts/DonutChartCard';
import { dashboardApi } from '@/lib/api/modules';
import { formatNumber } from '@/lib/utils/format';

const DONUT_COLORS = ['#b3471f', '#3454c7', '#c9791e', '#8a7b74', '#2f8132', '#6b5d56'];

function RankingCard({
  title,
  items,
  unit,
}: {
  title: string;
  items: Array<{ name: string; value: number }>;
  unit: string;
}): React.JSX.Element {
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

export function DataAnalysisContent(): React.JSX.Element {
  const { data, isLoading } = useSWR('dashboard-analisa', () => dashboardApi.analisa());

  const kategoriData = (data?.kategoriComposition ?? []).map((k, i) => ({
    label: k.label,
    value: k.value,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
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
    </PageShell>
  );
}
