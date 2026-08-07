'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface CodRow {
  id: string;
  code: string;
  customer: string;
  amount: number;
  courier: string;
  date: string;
  status: 'Lunas' | 'Menunggu' | 'Bermasalah';
}

const COD_ROWS: CodRow[] = [
  {
    id: 'cod-1',
    code: 'COD-9021',
    customer: 'Toko Sumber Rejeki',
    amount: 1250000,
    courier: 'Yusuf Maulana',
    date: '2026-08-04',
    status: 'Lunas',
  },
  {
    id: 'cod-2',
    code: 'COD-9022',
    customer: 'Minimarket Sejahtera',
    amount: 640000,
    courier: 'Dedi Kurniawan',
    date: '2026-08-05',
    status: 'Menunggu',
  },
  {
    id: 'cod-3',
    code: 'COD-9023',
    customer: 'Warung Bu Yanti',
    amount: 320000,
    courier: 'Yusuf Maulana',
    date: '2026-08-03',
    status: 'Bermasalah',
  },
];

const statusVariant: Record<CodRow['status'], 'success' | 'warning' | 'danger'> = {
  Lunas: 'success',
  Menunggu: 'warning',
  Bermasalah: 'danger',
};

export function CodMonitoringContent(): React.JSX.Element {
  const columns: DataTableColumn<CodRow>[] = [
    { key: 'code', header: 'Kode COD', render: (row) => row.code },
    { key: 'customer', header: 'Pelanggan', render: (row) => row.customer },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      render: (row) => formatCurrency(row.amount),
    },
    { key: 'courier', header: 'Kurir', render: (row) => row.courier },
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.date) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge label={row.status} variant={statusVariant[row.status]} />,
    },
  ];

  return (
    <PageShell title="COD Monitoring" breadcrumb="Pengiriman / COD Monitoring">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total COD', value: COD_ROWS.length },
          {
            id: 'lunas',
            label: 'Lunas',
            value: COD_ROWS.filter((r) => r.status === 'Lunas').length,
          },
          {
            id: 'menunggu',
            label: 'Menunggu Setor',
            value: COD_ROWS.filter((r) => r.status === 'Menunggu').length,
          },
          {
            id: 'nominal',
            label: 'Total Nominal',
            value: formatCurrency(COD_ROWS.reduce((sum, r) => sum + r.amount, 0)),
          },
        ]}
      />
      <DataTable
        title="Transaksi COD"
        description="Pantau status pembayaran cash on delivery"
        columns={columns}
        rows={COD_ROWS}
        getRowId={(row) => row.id}
      />
    </PageShell>
  );
}
