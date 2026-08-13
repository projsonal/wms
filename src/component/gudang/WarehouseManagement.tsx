'use client';

import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { warehousesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { useAuth } from '@/auth/AuthContext';
import { listErrorMessage } from '@/lib/utils/errors';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Warehouse } from '@/types';

export function WarehouseManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const { rows, isLoading, error, mutate } = useResourceList('warehouses-management', warehousesApi);

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
      render: (row) =>
        row.capacity > 0 ? `${Math.round((row.usedCapacity / row.capacity) * 100)}%` : '-',
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
      {/* Toggle Aktif/Nonaktifkan sudah punya tombol sendiri per baris.
          Tambah/hapus gudang dilakukan di menu WMS (/warehouse) yang
          punya form lengkap (nama, alamat, kapasitas, dst) — Add/Change/
          Delete/Protect generik di sini sengaja disembunyikan supaya
          tidak dobel dengan halaman itu. Print tetap diaktifkan untuk
          super admin (rekap status gudang siap cetak/A4). */}
      <DataTable
        title="Kelola Status Gudang"
        description="Aktifkan atau nonaktifkan gudang operasional"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        visibleActions={['print']}
        onRowAction={(action) => {
          if (action !== 'print') return;
          printRowsToPdf(
            rows,
            [
              { header: 'Nama Gudang', accessor: (r: Warehouse) => r.name },
              { header: 'PIC', accessor: (r: Warehouse) => r.picName },
              {
                header: 'Utilisasi',
                accessor: (r: Warehouse) =>
                  r.capacity > 0 ? `${Math.round((r.usedCapacity / r.capacity) * 100)}%` : '-',
              },
              { header: 'Total Barang', accessor: (r: Warehouse) => formatNumber(r.totalItems) },
              { header: 'Status', accessor: (r: Warehouse) => r.status },
            ],
            {
              title: 'Rekap Data Gudang — Status Gudang',
              subtitle: 'Manajemen / Manajemen Gudang',
              description: 'Status aktif/nonaktif tiap gudang operasional beserta utilisasi kapasitas dan total barang tersimpan.',
              generatedBy: user?.fullName,
            },
          );
        }}
      />
    </PageShell>
  );
}
