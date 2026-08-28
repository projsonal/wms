'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Printer, Lock } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { deliveriesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { printResiPengiriman } from '@/lib/utils/print-resi';
import { formatDate } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';
import type { Delivery } from '@/types';

export function DeliveryMonitoringContent(): React.JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const { rows, isLoading, error, mutate } = useResourceList('delivery-monitoring', deliveriesApi);
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete(selectedRows: Delivery[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk dihapus.');
      return;
    }
    const protectedRows = selectedRows.filter((r) => r.isProtected);
    if (protectedRows.length > 0) {
      toast.error('Ada baris yang dikunci (Protect) — buka kuncinya dulu sebelum dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Pengiriman',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} data terpilih?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => deliveriesApi.remove(r.id)));
      toast.success(`${selectedRows.length} data berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus sebagian/semua data terpilih.'));
    }
  }

  async function handleBulkProtect(selectedRows: Delivery[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk di-protect.');
      return;
    }
    const shouldProtect = selectedRows.some((r) => !r.isProtected);
    const ok = await confirm({
      title: shouldProtect ? 'Kunci (Protect) Data' : 'Buka Kunci Data',
      message: `${shouldProtect ? 'Kunci' : 'Buka kunci'} ${selectedRows.length} data terpilih dari perubahan/penghapusan?`,
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka Kunci',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => deliveriesApi.setProtected(r.id, shouldProtect)));
      toast.success('Status proteksi berhasil diubah.');
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  const DELIVERY_MON_COLUMNS = [
    { header: 'Resi', accessor: (row: Delivery) => row.code },
    { header: 'Kurir', accessor: (row: Delivery) => row.courierName },
    { header: 'Tujuan', accessor: (row: Delivery) => row.destination },
    { header: 'Jadwal', accessor: (row: Delivery) => formatDate(row.scheduledAt) },
    { header: 'Status', accessor: (row: Delivery) => DELIVERY_STATUS_META[row.status].label },
  ];
  const DELIVERY_MON_PDF_META = {
    title: 'Rekap Data Gudang — Monitoring Pengiriman',
    subtitle: 'Pengiriman / Monitoring Pengiriman',
    description: 'Status real-time seluruh resi pengiriman yang sedang berjalan maupun sudah selesai, beserta kurir dan tujuan masing-masing.',
  };

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    switch (action) {
      case 'add':
        router.push('/pickup-dropoff');
        return;
      case 'modify':
        setIsBulkMode((prev) => !prev);
        setSelectedIds(new Set());
        return;
      case 'change':
        if (!isBulkMode || selectedRows.length !== 1) {
          toast('Aktifkan "Modify", pilih tepat satu baris, lalu ubah lewat halaman Pickup & Dropoff.');
          return;
        }
        router.push('/pickup-dropoff');
        return;
      case 'delete':
        await handleBulkDelete(selectedRows);
        return;
      case 'protect':
        await handleBulkProtect(selectedRows);
        return;
      case 'export':
        requestExport(rows, DELIVERY_MON_COLUMNS, 'monitoring-pengiriman', DELIVERY_MON_PDF_META);
        return;
      case 'print':
        printRowsToPdf(rows, DELIVERY_MON_COLUMNS, { ...DELIVERY_MON_PDF_META, generatedBy: user?.fullName });
        return;
      default:
        return;
    }
  }

  const columns: DataTableColumn<Delivery>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Delivery) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Delivery>,
        ]
      : []),
    { key: 'code', header: 'Resi', render: (row) => row.code },
    { key: 'courier', header: 'Kurir', render: (row) => row.courierName },
    { key: 'destination', header: 'Tujuan', render: (row) => row.destination },
    { key: 'scheduled', header: 'Jadwal', render: (row) => formatDate(row.scheduledAt) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = DELIVERY_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Link
            href={`/delivery/${row.id}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Lacak
          </Link>
          <button
            type="button"
            onClick={() => printResiPengiriman(row, user?.fullName)}
            title="Cetak Resi"
            className="rounded p-1 text-textMuted hover:bg-surfaceAlt hover:text-text"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci (Protect)" /> : null}
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Monitoring Pengiriman" breadcrumb="Pengiriman / Monitoring Pengiriman">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Pengiriman', value: rows.length },
          {
            id: 'transit',
            label: 'Dalam Perjalanan',
            value: rows.filter((r) => r.status === 'perjalanan').length,
          },
          {
            id: 'terkirim',
            label: 'Terkirim',
            value: rows.filter((r) => r.status === 'terkirim').length,
          },
          {
            id: 'gagal',
            label: 'Gagal Kirim',
            value: rows.filter((r) => r.status === 'gagal').length,
          },
        ]}
      />
      {isBulkMode ? (
        <p className="-mb-2 text-xs text-textMuted">
          Mode Modify aktif — {selectedIds.size} baris terpilih. Pakai Delete/Protect di action bar (Change
          mengarahkan ke halaman Pickup & Dropoff).
        </p>
      ) : null}
      <DataTable
        title="Status Real-time Pengiriman"
        description="Pantau posisi & status setiap resi yang sedang berjalan"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="pengiriman"
      />
      {exportDialog}
    </PageShell>
  );
}
