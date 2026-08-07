'use client';

import { useState } from 'react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import {
  SEED_ITEMS,
  SEED_TRANSACTIONS,
  SEED_WAREHOUSES,
  type StockTransactionRow,
} from '@/lib/data/sample-data';

export function GoodsInContent(): React.JSX.Element {
  const rows = SEED_TRANSACTIONS.filter((row) => row.type === 'Masuk');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemId, setItemId] = useState(SEED_ITEMS[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState(SEED_WAREHOUSES[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);

  const columns: DataTableColumn<StockTransactionRow>[] = [
    { key: 'date', header: 'Tanggal', render: (row) => row.date },
    { key: 'code', header: 'Kode', render: (row) => row.code },
    { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
    { key: 'quantity', header: 'Jumlah', render: (row) => row.quantity },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge label={row.status} variant={row.status === 'Selesai' ? 'success' : 'warning'} />
      ),
    },
  ];

  return (
    <PageShell
      title="Barang Masuk"
      breadcrumb="Pengelolaan / Barang Masuk"
      action={<Button onClick={() => setIsModalOpen(true)}>+ Input Barang Masuk</Button>}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Transaksi', value: rows.length },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'Selesai').length,
          },
          {
            id: 'proses',
            label: 'Diproses',
            value: rows.filter((r) => r.status === 'Proses').length,
          },
          { id: 'bulan-ini', label: 'Bulan Ini', value: rows.length },
        ]}
      />
      <DataTable
        title="Riwayat Barang Masuk"
        description="Catatan penerimaan barang ke gudang"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
      />

      <Modal
        isOpen={isModalOpen}
        title="Input Barang Masuk"
        onClose={() => setIsModalOpen(false)}
        onEnterSubmit={() => setIsModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>Simpan</Button>
          </>
        }
      >
        <Select
          label="Barang"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          options={SEED_ITEMS.map((item) => ({ label: item.name, value: item.id }))}
        />
        <Select
          label="Gudang Tujuan"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          options={SEED_WAREHOUSES.map((wh) => ({ label: wh.name, value: wh.id }))}
        />
        <Input
          label="Jumlah"
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </Modal>
    </PageShell>
  );
}
