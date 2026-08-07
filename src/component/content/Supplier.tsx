'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { suppliersApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_SUPPLIERS } from '@/lib/data/sample-data';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Supplier } from '@/types';

export function SupplierContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList('suppliers', suppliersApi, SEED_SUPPLIERS);

  const columns: DataTableColumn<Supplier>[] = [
    { key: 'name', header: 'Nama Supplier', render: (row) => row.name },
    { key: 'contact', header: 'Kontak', render: (row) => row.contactPerson },
    { key: 'phone', header: 'No. Telepon', render: (row) => row.phone },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'orders', header: 'Total Order', align: 'right', render: (row) => row.totalOrders },
    { key: 'rating', header: 'Rating', align: 'right', render: (row) => row.rating.toFixed(1) },
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
    <PageShell
      title="Supplier"
      breadcrumb="Menu Utama / Supplier"
      action={<Button>+ Tambah Supplier</Button>}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Supplier', value: rows.length },
          {
            id: 'aktif',
            label: 'Supplier Aktif',
            value: rows.filter((r) => r.status === 'aktif').length,
          },
          {
            id: 'orders',
            label: 'Total Order',
            value: rows.reduce((sum, r) => sum + r.totalOrders, 0),
          },
          {
            id: 'rating',
            label: 'Rating Rata-rata',
            value: (rows.reduce((sum, r) => sum + r.rating, 0) / (rows.length || 1)).toFixed(1),
          },
        ]}
      />
      <DataTable
        title="Daftar Supplier"
        description="Mitra pemasok barang aktif maupun nonaktif"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
