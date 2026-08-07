'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { TrendChartCard } from '@/component/charts/TrendChartCard';
import { Card } from '@/component/ui/Card';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { buildReportRows, SEED_TRAFFIC } from '@/lib/data/sample-data';
import type { ReportRow } from '@/types';

interface ReportPageTemplateProps {
  title: string;
  breadcrumb: string;
  reportPrefix: string;
}

const REPORT_COLUMNS: DataTableColumn<ReportRow>[] = [
  { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.date) },
  { key: 'reference', header: 'Referensi', render: (row) => row.reference },
  { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouseName },
  { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
  {
    key: 'quantity',
    header: 'Jumlah',
    align: 'right',
    render: (row) => formatNumber(row.quantity),
  },
  { key: 'value', header: 'Nilai', align: 'right', render: (row) => formatCurrency(row.value) },
  { key: 'status', header: 'Status', render: (row) => row.status },
];

export function ReportPageTemplate({
  title,
  breadcrumb,
  reportPrefix,
}: ReportPageTemplateProps): React.JSX.Element {
  const rows = buildReportRows(reportPrefix);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <PageShell
      title={title}
      breadcrumb={breadcrumb}
      action={<Button variant="secondary">Unduh Laporan</Button>}
    >
      <StatsRow
        stats={[
          { id: 'transaksi', label: 'Total Transaksi', value: rows.length },
          { id: 'qty', label: 'Total Kuantitas', value: formatNumber(totalQuantity) },
          { id: 'nilai', label: 'Total Nilai', value: formatCurrency(totalValue) },
          {
            id: 'gudang',
            label: 'Gudang Terlibat',
            value: new Set(rows.map((r) => r.warehouseName)).size,
          },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <TrendChartCard
          title="Tren Transaksi"
          subtitle="7 periode terakhir"
          data={SEED_TRAFFIC}
          primaryLabel="Jumlah Transaksi"
        />
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">Top Barang</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {rows.slice(0, 5).map((row, index) => (
              <li key={row.id} className="flex items-center justify-between">
                <span className="text-text">
                  {index + 1}. {row.itemName}
                </span>
                <span className="text-xs text-textMuted">{formatNumber(row.quantity)} unit</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <DataTable
        title="Rincian Laporan"
        description="Detail transaksi pada periode berjalan"
        columns={REPORT_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
      />
    </PageShell>
  );
}
