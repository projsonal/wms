'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { inventoryApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';
import type { InventoryRecord } from '@/types';

/**
 * PENTING soal Add/Change/Delete/Modify/Protect di halaman ini: tabel ini
 * adalah AGREGAT baca-saja hasil Stock Opname terakhir per SKU per gudang —
 * bukan entitas tersendiri (tidak ada endpoint POST/PUT/DELETE
 * "/inventaris" di backend, angka di sini murni turunan dokumen Stock
 * Opname). Karena itu:
 *  - "Add"     -> diarahkan ke Manajemen Inventaris (buat sesi opname baru,
 *                 tempat asal data ini benar-benar berubah).
 *  - "Change"/"Delete"/"Protect" -> tidak punya padanan nyata per-baris di
 *                 sini (baris ini bukan record yang bisa diedit/dihapus
 *                 langsung), jadi ditampilkan tapi mengarahkan/menjelaskan
 *                 ke Manajemen Inventaris alih-alih pura-pura berfungsi.
 */
export function InventoryOverviewContent(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { rows, isLoading, error } = useResourceList('inventory', inventoryApi);
  const { requestExport, dialog: exportDialog } = useExportFormat();

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

  const INVENTORY_EXPORT_COLUMNS = [
    { header: 'SKU', accessor: (row: InventoryRecord) => row.sku },
    { header: 'Nama Barang', accessor: (row: InventoryRecord) => row.itemName },
    { header: 'Gudang', accessor: (row: InventoryRecord) => row.warehouseName },
    { header: 'Kuantitas', accessor: (row: InventoryRecord) => `${row.quantity} ${row.unit}` },
    { header: 'Opname Terakhir', accessor: (row: InventoryRecord) => formatDate(row.lastOpname) },
    { header: 'Selisih', accessor: (row: InventoryRecord) => String(row.variance) },
    { header: 'Status', accessor: (row: InventoryRecord) => row.status },
  ];
  const INVENTORY_PDF_META = {
    title: 'Rekap Data Gudang — Ringkasan Inventaris',
    subtitle: 'Menu Utama / Inventaris',
    description: 'Ringkasan kuantitas stok per SKU berdasarkan hasil Stock Opname terakhir di masing-masing gudang, beserta status kesesuaian terhadap catatan sistem.',
  };

  function handleExport(): void {
    requestExport(rows, INVENTORY_EXPORT_COLUMNS, 'ringkasan-inventaris', INVENTORY_PDF_META);
  }

  function handleRowAction(action: TableRowAction): void {
    switch (action) {
      case 'export':
        handleExport();
        return;
      case 'print':
        printRowsToPdf(rows, INVENTORY_EXPORT_COLUMNS, { ...INVENTORY_PDF_META, generatedBy: user?.fullName });
        return;
      case 'add':
        toast('Data di sini berasal dari sesi Stock Opname — diarahkan ke Manajemen Inventaris.');
        router.push('/home/inventory-management');
        return;
      case 'change':
      case 'delete':
      case 'modify':
      case 'protect':
        toast(
          'Baris di sini adalah ringkasan hasil opname terakhir, bukan record yang bisa diubah/dihapus/di-protect langsung. Buka atau selesaikan sesi Stock Opname di Manajemen Inventaris untuk mengubah stok.',
        );
        return;
      default:
        return;
    }
  }

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
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="stock_opname"
      />
      {exportDialog}
    </PageShell>
  );
}
