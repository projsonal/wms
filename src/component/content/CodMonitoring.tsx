'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { CurrencyField, Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { codApi, type CodStatus, type CodTransactionRaw } from '@/lib/api/modules';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';

const STATUS_LABEL: Record<CodStatus, string> = {
  lunas: 'Lunas',
  menunggu: 'Menunggu',
  bermasalah: 'Bermasalah',
};
const statusVariant: Record<CodStatus, 'success' | 'warning' | 'danger'> = {
  lunas: 'success',
  menunggu: 'warning',
  bermasalah: 'danger',
};

const EMPTY_FORM = { kode: '', pelanggan: '', nominal: 0, kurir: '', tanggal: '', status: 'menunggu' as CodStatus };

/** Pesan error yang konsisten untuk 403 dari backend (role/izin ditolak),
 * supaya pengguna langsung tahu harus minta izin ke siapa, bukan bingung
 * kenapa tombolnya "tidak ngefek". */
const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';


export function CodMonitoringContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('cod', codApi);
  const { data: summary, mutate: mutateSummary } = useSWR('cod-summary', () => codApi.summary());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function refreshAll(): Promise<void> {
    await Promise.all([mutate(), mutateSummary()]);
  }

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: CodTransactionRaw): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(String(row.id));
    setForm({
      kode: row.kode,
      pelanggan: row.pelanggan,
      nominal: row.nominal,
      kurir: row.kurir,
      tanggal: row.tanggal.slice(0, 10),
      status: row.status,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    try {
      if (editingId) {
        await codApi.update(editingId, form);
        toast.success('Transaksi COD berhasil diperbarui.');
      } else {
        await codApi.create(form);
        toast.success('Transaksi COD baru berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan transaksi COD.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: CodTransactionRaw): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Transaksi COD',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await codApi.remove(String(row.id));
      toast.success('Transaksi COD berhasil dihapus.');
      await refreshAll();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus transaksi COD.'));
    }
  }

  async function handleToggleProtect(row: CodTransactionRaw): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Data Ini?' : 'Buka Kunci Data Ini?',
      message: willProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await codApi.setProtected(String(row.id), willProtect);
      toast.success(willProtect ? 'Data dikunci (Protect).' : 'Data dibuka kuncinya.');
      await refreshAll();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const COD_EXPORT_COLUMNS = [
    { header: 'Kode', accessor: (r: CodTransactionRaw) => r.kode },
    { header: 'Nominal', accessor: (r: CodTransactionRaw) => r.nominal },
    { header: 'Status', accessor: (r: CodTransactionRaw) => r.status },
  ];
  const COD_PDF_META = {
    title: 'Rekap Data Gudang — COD Monitoring',
    subtitle: 'Pengiriman / COD Monitoring',
    description: 'Daftar transaksi Cash on Delivery (COD) beserta nominal dan status pembayaran/penyetorannya.',
  };

  function handleExport(): void {
    requestExport(rows, COD_EXPORT_COLUMNS, 'daftar-cod', COD_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, COD_EXPORT_COLUMNS, { ...COD_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: CodTransactionRaw[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu baris data yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU baris data untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: CodTransactionRaw[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Transaksi Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => codApi.remove(String(r.id))));
      toast.success(`${selectedRows.length} transaksi COD berhasil dihapus.`);
      setSelectedIds(new Set());
      await refreshAll();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus (mungkin ada yang di-Protect).'));
    }
  }

  async function handleBulkProtect(selectedRows: CodTransactionRaw[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih baris yang mau dikunci/dibuka.');
      return;
    }
    const shouldProtect = !selectedRows[0].isProtected;
    const ok = await confirm({
      title: shouldProtect ? 'Kunci Data Terpilih?' : 'Buka Kunci Data Terpilih?',
      message: shouldProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => codApi.setProtected(String(r.id), shouldProtect)));
      toast.success(shouldProtect ? 'Data terpilih dikunci.' : 'Data terpilih dibuka kuncinya.');
      setSelectedIds(new Set());
      await refreshAll();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(String(r.id)));

    switch (action) {
      case 'add':
        openCreateModal();
        return;
      case 'export':
        handleExport();
        return;
      case 'print':
        handlePrint();
        return;
      case 'modify':
        setIsBulkMode((prev) => !prev);
        setSelectedIds(new Set());
        return;
      case 'change':
        await handleBulkChange(selectedRows);
        return;
      case 'delete':
        await handleBulkDelete(selectedRows);
        return;
      case 'protect':
        await handleBulkProtect(selectedRows);
        return;
      default:
        return;
    }
  }

  const columns: DataTableColumn<CodTransactionRaw>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: CodTransactionRaw) => (
              <input
                type="checkbox"
                checked={selectedIds.has(String(row.id))}
                onChange={() => toggleSelected(String(row.id))}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<CodTransactionRaw>,
        ]
      : []),
    { key: 'code', header: 'Kode COD', render: (row) => row.kode },
    { key: 'customer', header: 'Pelanggan', render: (row) => row.pelanggan },
    { key: 'amount', header: 'Nominal', align: 'right', render: (row) => formatCurrency(row.nominal) },
    { key: 'courier', header: 'Kurir', render: (row) => row.kurir || '-' },
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge label={STATUS_LABEL[row.status]} variant={statusVariant[row.status]} />
          {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci" /> : null}
        </div>
      ),
    },
    {
      key: 'row-actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            title="Edit"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {isStaff ? (
            <button
              type="button"
              onClick={() => handleDeleteOne(row)}
              title="Hapus"
              className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => handleToggleProtect(row)}
              title={row.isProtected ? 'Buka kunci' : 'Kunci (Protect)'}
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              {row.isProtected ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <PageShell title="COD Monitoring" breadcrumb="Pengiriman / COD Monitoring">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total COD', value: summary?.total ?? rows.length },
          { id: 'lunas', label: 'Lunas', value: summary?.lunas ?? 0 },
          { id: 'menunggu', label: 'Menunggu Setor', value: summary?.menunggu ?? 0 },
          {
            id: 'nominal',
            label: 'Total Nominal',
            value: formatCurrency(summary?.totalNominal ?? 0),
          },
        ]}
      />
      {/* Tombol "+Tambah" di header SENGAJA dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel, sesuai
          arahan: "hilangkan button yang di header, gunakan animasi geser". */}
      <DataTable
        title="Transaksi COD"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete/Protect di atas.`
            : 'Pantau status pembayaran cash on delivery'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="cod"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Transaksi COD' : 'Tambah Transaksi COD'}
        onClose={() => setIsModalOpen(false)}
        onEnterSubmit={handleSave}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Simpan
            </Button>
          </>
        }
      >
        <Input
          label="Kode COD"
          value={form.kode}
          onChange={(e) => setForm({ ...form, kode: e.target.value })}
          placeholder="COD-2026-0001"
        />
        <Input
          label="Pelanggan"
          value={form.pelanggan}
          onChange={(e) => setForm({ ...form, pelanggan: e.target.value })}
        />
        <CurrencyField
          label="Nominal (Rp)"
          value={form.nominal}
          onValueChange={(value) => setForm({ ...form, nominal: value })}
        />
        <Input label="Kurir" value={form.kurir} onChange={(e) => setForm({ ...form, kurir: e.target.value })} />
        <Input
          label="Tanggal"
          type="date"
          value={form.tanggal}
          onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
        />
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as CodStatus })}
          options={[
            { label: 'Menunggu', value: 'menunggu' },
            { label: 'Lunas', value: 'lunas' },
            { label: 'Bermasalah', value: 'bermasalah' },
          ]}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
