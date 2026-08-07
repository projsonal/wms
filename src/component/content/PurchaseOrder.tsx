'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { purchaseOrdersApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_PURCHASE_ORDERS } from '@/lib/data/sample-data';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PO_STATUS_META } from '@/lib/utils/status';
import type { PurchaseOrder } from '@/types';

export function PurchaseOrderContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList(
    'purchase-orders',
    purchaseOrdersApi,
    SEED_PURCHASE_ORDERS,
  );

  const columns: DataTableColumn<PurchaseOrder>[] = [
    { key: 'number', header: 'No. Order', render: (row) => row.orderNumber },
    { key: 'supplier', header: 'Supplier', render: (row) => row.supplierName },
    { key: 'items', header: 'Jumlah Item', align: 'right', render: (row) => row.itemCount },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => formatCurrency(row.totalAmount),
    },
    { key: 'order-date', header: 'Tanggal Order', render: (row) => formatDate(row.orderDate) },
    { key: 'expected', header: 'Estimasi Tiba', render: (row) => formatDate(row.expectedDate) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = PO_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
  ];

  const totalValue = rows.reduce((sum, po) => sum + po.totalAmount, 0);

  return (
    <PageShell
      title="Purchase Order"
      breadcrumb="Menu Utama / Purchase Order"
      action={<Button>+ Buat Purchase Order</Button>}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total PO', value: rows.length },
          {
            id: 'proses',
            label: 'Sedang Diproses',
            value: rows.filter((r) => r.status === 'diproses').length,
          },
          { id: 'nilai', label: 'Total Nilai PO', value: formatCurrency(totalValue) },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'selesai').length,
          },
        ]}
      />
      <DataTable
        title="Daftar Purchase Order"
        description="Riwayat pemesanan barang ke supplier"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
