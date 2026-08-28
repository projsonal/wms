'use client';

import Link from 'next/link';
import { PackagePlus, PackageMinus, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { inventoryApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatNumber } from '@/lib/utils/format';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';
import type { StokGudangRecord } from '@/types';

export function InventoryOverviewContent(): React.JSX.Element {
  const { user } = useAuth();
  const { rows, isLoading, error } = useResourceList('ringkasan-stok', { list: inventoryApi.ringkasanStok });
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const columns: DataTableColumn<StokGudangRecord>[] = [
    { key: 'sku', header: 'SKU', render: (row) => row.sku },
    { key: 'item', header: 'Nama Barang', render: (row) => row.itemName },
    { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouseName },
    {
      key: 'qty',
      header: 'Kuantitas',
      align: 'right',
      render: (row) => formatNumber(row.quantity),
    },
  ];

  const INVENTORY_EXPORT_COLUMNS = [
    { header: 'SKU', accessor: (row: StokGudangRecord) => row.sku },
    { header: 'Nama Barang', accessor: (row: StokGudangRecord) => row.itemName },
    { header: 'Gudang', accessor: (row: StokGudangRecord) => row.warehouseName },
    { header: 'Kuantitas', accessor: (row: StokGudangRecord) => row.quantity },
  ];
  const INVENTORY_PDF_META = {
    title: 'Rekap Data Ringkasan Stok',
    subtitle: 'Menu Utama / Ringkasan Stok',
    description: 'Kuantitas stok per SKU per gudang, real-time dari ledger stok (ikut Barang Masuk/Keluar/Stock Opname terbaru).',
  };

  function handleExport(): void {
    requestExport(rows, INVENTORY_EXPORT_COLUMNS, 'ringkasan-stok', INVENTORY_PDF_META);
  }

  function handleRowAction(action: TableRowAction): void {
    switch (action) {
      case 'export':
        handleExport();
        return;
      case 'print':
        printRowsToPdf(rows, INVENTORY_EXPORT_COLUMNS, { ...INVENTORY_PDF_META, generatedBy: user?.fullName });
        return;
      default:
        return;
    }
  }

  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const distinctSku = new Set(rows.map((r) => r.sku)).size;
  const distinctGudang = new Set(rows.map((r) => r.gudangId)).size;

  return (
    <PageShell title="Ringkasan Stok" breadcrumb="Menu Utama / Ringkasan Stok">
      <StatsRow
        stats={[
          { id: 'baris', label: 'Baris Stok (SKU x Gudang)', value: rows.length },
          { id: 'sku', label: 'SKU Berbeda', value: distinctSku },
          { id: 'gudang', label: 'Gudang Terpakai', value: distinctGudang },
          { id: 'qty', label: 'Total Kuantitas', value: formatNumber(totalQuantity) },
        ]}
      />

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold text-text">Halaman ini cuma menampilkan, bukan tempat mengubah stok</h2>
          <p className="mt-1 text-xs text-textMuted">
            Kuantitas di tabel bawah dihitung OTOMATIS &amp; REAL-TIME dari transaksi yang sudah diselesaikan
            (Barang Masuk menambah, Barang Keluar mengurangi, per gudang masing-masing). jadi penjumlahan bukan angka yang
            diketik manual di sini. Untuk benar-benar mengubah stok, pakai salah satu dari tiga cara ini:
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/barang-masuk"
            className="flex items-start gap-2.5 rounded-lg border border-borderSoft p-3 transition-colors hover:border-accent"
          >
            <PackagePlus className="mt-0.5 h-4 w-4 flex-shrink-0 text-successText" />
            <span>
              <span className="block text-xs font-semibold text-text">Stok bertambah</span>
              <span className="block text-[11px] text-textMuted">
                Catat penerimaan barang lewat Barang Masuk, lalu selesaikan dokumennya.
              </span>
            </span>
          </Link>
          <Link
            href="/barang-keluar"
            className="flex items-start gap-2.5 rounded-lg border border-borderSoft p-3 transition-colors hover:border-accent"
          >
            <PackageMinus className="mt-0.5 h-4 w-4 flex-shrink-0 text-warningText" />
            <span>
              <span className="block text-xs font-semibold text-text">Stok berkurang</span>
              <span className="block text-[11px] text-textMuted">
                Catat pengeluaran barang lewat Barang Keluar, lalu selesaikan dokumennya.
              </span>
            </span>
          </Link>
          <Link
            href="/inventory-management"
            className="flex items-start gap-2.5 rounded-lg border border-borderSoft p-3 transition-colors hover:border-accent"
          >
            <ClipboardCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-accentDark" />
            <span>
              <span className="block text-xs font-semibold text-text">Stok sistem meleset dari fisik gudang</span>
              <span className="block text-[11px] text-textMuted">
                Buat/selesaikan sesi hitung fisik di Manajemen Inventaris (Stock Opname) untuk mengoreksi selisihnya.
              </span>
            </span>
          </Link>
        </div>
      </Card>

      <DataTable
        title="Ringkasan Stok"
        description="Kuantitas stok per SKU per gudang, REAL-TIME — bukan snapshot Stock Opname terakhir. Baca-saja, lihat kartu di atas untuk cara mengubah stok."
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        visibleActions={['export', 'print']}
        module="stock_opname"
      />
      {exportDialog}
    </PageShell>
  );
}