'use client';

import { useState } from 'react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { warehousesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_WAREHOUSES } from '@/lib/data/sample-data';
import { formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Warehouse } from '@/types';

export function WarehouseListContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList('warehouses', warehousesApi, SEED_WAREHOUSES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<Warehouse | null>(null);

  const totalCapacity = rows.reduce((sum, wh) => sum + wh.capacity, 0);
  const totalUsed = rows.reduce((sum, wh) => sum + wh.usedCapacity, 0);
  const totalItems = rows.reduce((sum, wh) => sum + wh.totalItems, 0);

  const columns: DataTableColumn<Warehouse>[] = [
    { key: 'code', header: 'Kode', render: (row) => row.code },
    { key: 'name', header: 'Nama Gudang', render: (row) => row.name },
    { key: 'address', header: 'Alamat', render: (row) => row.address },
    { key: 'pic', header: 'PIC', render: (row) => row.picName },
    {
      key: 'capacity',
      header: 'Kapasitas',
      align: 'right',
      render: (row) => `${formatNumber(row.usedCapacity)} / ${formatNumber(row.capacity)}`,
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
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelected(row);
            setIsModalOpen(true);
          }}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Detail
        </button>
      ),
    },
  ];

  return (
    <PageShell
      title="Warehouse Management System (WMS)"
      breadcrumb="Menu Utama / WMS"
      action={<Button>+ Tambah Gudang</Button>}
    >
      <StatsRow
        stats={[
          { id: 'jumlah-gudang', label: 'Jumlah Gudang', value: rows.length },
          {
            id: 'kapasitas',
            label: 'Kapasitas Terpakai',
            value: `${formatNumber(totalUsed)} Unit`,
          },
          {
            id: 'total-kapasitas',
            label: 'Total Kapasitas',
            value: `${formatNumber(totalCapacity)} Unit`,
          },
          { id: 'total-barang', label: 'Total Barang', value: formatNumber(totalItems) },
        ]}
      />
      <DataTable
        title="Daftar Gudang"
        description="Persebaran gudang beserta kapasitas & PIC"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />

      <Modal
        isOpen={isModalOpen}
        title={selected?.name ?? 'Detail Gudang'}
        onClose={() => setIsModalOpen(false)}
      >
        {selected ? (
          <div className="flex flex-col gap-3 text-sm">
            <Input label="Kode Gudang" value={selected.code} readOnly />
            <Input label="Alamat" value={selected.address} readOnly />
            <Input label="PIC Gudang" value={selected.picName} readOnly />
            <Input
              label="Kapasitas"
              value={`${formatNumber(selected.usedCapacity)} / ${formatNumber(selected.capacity)} unit`}
              readOnly
            />
          </div>
        ) : null}
      </Modal>
    </PageShell>
  );
}
