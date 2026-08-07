'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { inventoryApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_INVENTORY } from '@/lib/data/sample-data';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { InventoryRecord } from '@/types';

export function InventoryOverviewContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList('inventory', inventoryApi, SEED_INVENTORY);

  const columns: DataTableColumn<InventoryRecord>[] = [
    { key: 'sku', header: 'SKU', render: (row) => row.sku },
    { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
    { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouseName },
    {
      key: 'qty',
      header: 'Kuantitas',
      align: 'right',
      render: (row) => `${formatNumber(row.quantity)} ${row.unit}`,
    },
    { key: 'opname', header: 'Opname Terakhir', render: (row) => formatDate(row.lastOpname) },
    { key: 'variance', header: 'Selisih', align: 'right', render: (row) => row.variance },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status];
        return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status;
      },
    },
  ];

  return (
    <PageShell title="Inventaris" breadcrumb="Menu Utama / Inventaris">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total SKU', value: rows.length },
          {
            id: 'sesuai',
            label: 'Sesuai',
            value: rows.filter((r) => r.status === 'sesuai').length,
          },
          {
            id: 'selisih',
            label: 'Ada Selisih',
            value: rows.filter((r) => r.status === 'selisih').length,
          },
          {
            id: 'qty',
            label: 'Total Kuantitas',
            value: formatNumber(rows.reduce((sum, r) => sum + r.quantity, 0)),
          },
        ]}
      />
      <DataTable
        title="Ringkasan Inventaris"
        description="Kuantitas stok per SKU dari opname terakhir"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
