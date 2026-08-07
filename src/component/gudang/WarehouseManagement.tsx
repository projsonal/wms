'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { warehousesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_WAREHOUSES } from '@/lib/data/sample-data';
import { formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Warehouse } from '@/types';

export function WarehouseManagementContent(): React.JSX.Element {
  const { rows, isLoading, mutate } = useResourceList(
    'warehouses-management',
    warehousesApi,
    SEED_WAREHOUSES,
  );

  async function toggleStatus(warehouse: Warehouse): Promise<void> {
    const nextStatus = warehouse.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      await warehousesApi.update(warehouse.id, { status: nextStatus });
    } finally {
      await mutate();
    }
  }

  const columns: DataTableColumn<Warehouse>[] = [
    { key: 'name', header: 'Nama Gudang', render: (row) => row.name },
    { key: 'pic', header: 'PIC', render: (row) => row.picName },
    {
      key: 'utilisasi',
      header: 'Utilisasi',
      align: 'right',
      render: (row) => `${Math.round((row.usedCapacity / row.capacity) * 100)}%`,
    },
    {
      key: 'items',
      header: 'Total Barang',
      align: 'right',
      render: (row) => formatNumber(row.totalItems),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status];
        return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status;
      },
    },
    {
      key: 'action',
      header: 'Aksi',
      render: (row) => (
        <Button variant="secondary" onClick={() => toggleStatus(row)}>
          {row.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="Manajemen Gudang" breadcrumb="Manajemen / Manajemen Gudang">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Gudang', value: rows.length },
          {
            id: 'aktif',
            label: 'Gudang Aktif',
            value: rows.filter((r) => r.status === 'aktif').length,
          },
          {
            id: 'kapasitas',
            label: 'Total Kapasitas',
            value: `${formatNumber(rows.reduce((s, r) => s + r.capacity, 0))} Unit`,
          },
          {
            id: 'terpakai',
            label: 'Kapasitas Terpakai',
            value: `${formatNumber(rows.reduce((s, r) => s + r.usedCapacity, 0))} Unit`,
          },
        ]}
      />
      <DataTable
        title="Kelola Status Gudang"
        description="Aktifkan atau nonaktifkan gudang operasional"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
