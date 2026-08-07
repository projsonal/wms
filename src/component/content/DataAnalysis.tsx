'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { StatsRow } from '@/component/ui/StatsRow';
import { DonutChartCard } from '@/component/charts/DonutChartCard';

const CATEGORY_COMPOSITION = [
  { label: 'Sembako', value: 42, color: '#b3471f' },
  { label: 'Minuman', value: 21, color: '#3454c7' },
  { label: 'Packaging', value: 18, color: '#c9791e' },
  { label: 'Lainnya', value: 19, color: '#8a7b74' },
];

const RESTOCK_RANKING = [
  { name: 'Minyak Goreng 2L', value: '48x direstok', trend: 'Naik 12%' },
  { name: 'Galon Air Mineral 19L', value: '35x direstok', trend: 'Naik 8%' },
  { name: 'Beras Premium 5kg', value: '22x direstok', trend: 'Stabil' },
];

const RETURN_RANKING = [
  { name: 'Kardus Packing Sedang', value: '14 unit retur', trend: 'Turun 4%' },
  { name: 'Galon Air Mineral 19L', value: '9 unit retur', trend: 'Naik 2%' },
  { name: 'Minyak Goreng 2L', value: '5 unit retur', trend: 'Stabil' },
];

export function DataAnalysisContent(): React.JSX.Element {
  return (
    <PageShell title="Analisa Data" breadcrumb="Pengiriman / Analisa Data">
      <StatsRow
        stats={[
          { id: 'sku', label: 'SKU Dianalisis', value: 128 },
          { id: 'restock', label: 'Total Restock Bulan Ini', value: 96 },
          { id: 'retur', label: 'Total Retur Bulan Ini', value: 12 },
          { id: 'akurasi', label: 'Akurasi Prediksi Stok', value: '87%' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
        <DonutChartCard
          title="Komposisi Kategori Barang"
          subtitle="Berdasarkan jumlah SKU"
          data={CATEGORY_COMPOSITION}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-text">Barang Paling Sering Direstok</h2>
            <ul className="flex flex-col gap-3">
              {RESTOCK_RANKING.map((item, index) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-text">
                    <span className="mr-2 text-textMuted">{index + 1}.</span>
                    {item.name}
                  </span>
                  <span className="text-right text-xs text-textMuted">
                    {item.value}
                    <br />
                    {item.trend}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-text">Ranking Retur Barang</h2>
            <ul className="flex flex-col gap-3">
              {RETURN_RANKING.map((item, index) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-text">
                    <span className="mr-2 text-textMuted">{index + 1}.</span>
                    {item.name}
                  </span>
                  <span className="text-right text-xs text-textMuted">
                    {item.value}
                    <br />
                    {item.trend}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
