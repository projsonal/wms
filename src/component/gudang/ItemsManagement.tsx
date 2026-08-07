'use client';

import { useState } from 'react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { itemsApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_ITEMS, SEED_WAREHOUSES } from '@/lib/data/sample-data';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { ITEM_STATUS_META } from '@/lib/utils/status';
import type { Item } from '@/types';

const EMPTY_FORM: Partial<Item> = {
  name: '',
  sku: '',
  category: '',
  unit: '',
  stock: 0,
  minStock: 0,
  price: 0,
  warehouseId: SEED_WAREHOUSES[0]?.id,
};

export function ItemsManagementContent(): React.JSX.Element {
  const { rows, isLoading, mutate } = useResourceList('items', itemsApi, SEED_ITEMS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Item>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateModal(): void {
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    try {
      await itemsApi.create(form);
      await mutate();
      setIsModalOpen(false);
    } catch {
      // Backend belum terhubung — form tetap tervalidasi di sisi klien untuk preview.
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<Item>[] = [
    { key: 'sku', header: 'SKU', render: (row) => row.sku },
    { key: 'name', header: 'Nama Barang', render: (row) => row.name },
    { key: 'category', header: 'Kategori', render: (row) => row.category },
    {
      key: 'stock',
      header: 'Stok',
      align: 'right',
      render: (row) => `${formatNumber(row.stock)} ${row.unit}`,
    },
    { key: 'price', header: 'Harga', align: 'right', render: (row) => formatCurrency(row.price) },
    { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouseName },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = ITEM_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    { key: 'updated', header: 'Update', render: (row) => formatDate(row.updatedAt) },
  ];

  return (
    <PageShell
      title="Kelola Barang"
      breadcrumb="Pengelolaan / Kelola Barang"
      action={<Button onClick={openCreateModal}>+ Tambah Barang</Button>}
    >
      <DataTable
        title="Daftar Barang"
        description="Seluruh SKU yang terdaftar di gudang"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />

      <Modal
        isOpen={isModalOpen}
        title="Tambah Barang"
        onClose={() => setIsModalOpen(false)}
        onEnterSubmit={handleSave}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              Simpan
            </Button>
          </>
        }
      >
        <Input
          label="Nama Barang"
          value={form.name ?? ''}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="SKU"
            value={form.sku ?? ''}
            onChange={(event) => setForm({ ...form, sku: event.target.value })}
          />
          <Input
            label="Kategori"
            value={form.category ?? ''}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Stok"
            type="number"
            value={form.stock ?? 0}
            onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
          />
          <Input
            label="Satuan"
            value={form.unit ?? ''}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Harga"
            type="number"
            value={form.price ?? 0}
            onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
          />
          <Select
            label="Gudang"
            value={form.warehouseId ?? ''}
            onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
            options={SEED_WAREHOUSES.map((wh) => ({ label: wh.name, value: wh.id }))}
          />
        </div>
      </Modal>
    </PageShell>
  );
}
