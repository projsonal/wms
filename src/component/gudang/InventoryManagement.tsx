'use client';

import { useState } from 'react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { inventoryApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_INVENTORY } from '@/lib/data/sample-data';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { InventoryRecord } from '@/types';

export function InventoryManagementContent(): React.JSX.Element {
  const { rows, isLoading, mutate } = useResourceList(
    'inventory-management',
    inventoryApi,
    SEED_INVENTORY,
  );
  const [adjusting, setAdjusting] = useState<InventoryRecord | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

  function openAdjustModal(record: InventoryRecord): void {
    setAdjusting(record);
    setNewQuantity(record.quantity);
  }

  async function submitAdjustment(): Promise<void> {
    if (!adjusting) return;
    try {
      await inventoryApi.update(adjusting.id, { quantity: newQuantity });
    } finally {
      await mutate();
      setAdjusting(null);
    }
  }

  const columns: DataTableColumn<InventoryRecord>[] = [
    { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
    { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouseName },
    {
      key: 'qty',
      header: 'Kuantitas Sistem',
      align: 'right',
      render: (row) => `${formatNumber(row.quantity)} ${row.unit}`,
    },
    { key: 'variance', header: 'Selisih Opname', align: 'right', render: (row) => row.variance },
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
        <Button variant="secondary" onClick={() => openAdjustModal(row)}>
          Sesuaikan Stok
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="Manajemen Inventaris" breadcrumb="Manajemen / Manajemen Inventaris">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total SKU Dipantau', value: rows.length },
          {
            id: 'selisih',
            label: 'Perlu Penyesuaian',
            value: rows.filter((r) => r.status === 'selisih').length,
          },
          {
            id: 'opname-terakhir',
            label: 'Opname Terbaru',
            value: formatDate(rows[0]?.lastOpname ?? new Date()),
          },
          {
            id: 'qty',
            label: 'Total Kuantitas',
            value: formatNumber(rows.reduce((sum, r) => sum + r.quantity, 0)),
          },
        ]}
      />
      <DataTable
        title="Penyesuaian Stok Opname"
        description="Selisih antara catatan sistem dan hasil stok opname fisik"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />

      <Modal
        isOpen={Boolean(adjusting)}
        title={`Sesuaikan Stok - ${adjusting?.itemName ?? ''}`}
        onClose={() => setAdjusting(null)}
        onEnterSubmit={submitAdjustment}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Batal
            </Button>
            <Button onClick={submitAdjustment}>Simpan Penyesuaian</Button>
          </>
        }
      >
        <Input
          label="Kuantitas Baru"
          type="number"
          value={newQuantity}
          onChange={(event) => setNewQuantity(Number(event.target.value))}
        />
      </Modal>
    </PageShell>
  );
}
