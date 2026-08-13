'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Pencil, CheckCircle2, XCircle } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { barangRusakApi, type BarangRusakPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { BARANG_RUSAK_STATUS_META } from '@/lib/utils/status';
import type { BarangRusak } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<BarangRusakPayload> = { labelBarang: '', namaBarang: '', keterangan: '' };

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus laporan barang rusak ini?';

function BarangRusakBody(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('barang-rusak', barangRusakApi);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BarangRusakPayload>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: BarangRusak): void {
    if (row.status !== 'pengecekan') {
      toast.error('Data yang sudah diperiksa tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      labelBarang: row.labelBarang,
      namaBarang: row.namaBarang,
      keterangan: row.keterangan ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.labelBarang || !form.namaBarang) {
      toast.error('Label/kode barang dan nama barang wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: BarangRusakPayload = {
        labelBarang: form.labelBarang,
        namaBarang: form.namaBarang,
        keterangan: form.keterangan ?? '',
      };
      if (editingId) {
        await barangRusakApi.update(editingId, payload);
        toast.success('Laporan barang rusak berhasil diperbarui.');
      } else {
        await barangRusakApi.create(payload);
        toast.success('Laporan berhasil dibuat, menunggu pengecekan fisik.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan laporan barang rusak.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: BarangRusak): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Laporan Barang Rusak',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await barangRusakApi.remove(row.id);
      toast.success('Laporan berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus laporan.'));
    }
  }

  async function handleInspeksi(row: BarangRusak, jenis: 'retur' | 'rusak'): Promise<void> {
    const ok = await confirm({
      title: jenis === 'retur' ? 'Tandai Bisa Diretur?' : 'Tandai Rusak (Tidak Bisa Diretur)?',
      message:
        jenis === 'retur'
          ? 'Hasil pengecekan fisik akan dikunci sebagai "Bisa Diretur" — barang akan diproses retur ke supplier.'
          : 'Hasil pengecekan fisik akan dikunci sebagai "Rusak" — barang tidak bisa diretur ke supplier.',
      confirmLabel: 'Ya, Simpan',
      variant: jenis === 'retur' ? 'default' : 'danger',
    });
    if (!ok) return;
    try {
      await barangRusakApi.inspeksi(row.id, jenis);
      toast.success('Hasil pengecekan berhasil disimpan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan hasil pengecekan.'));
    }
  }

  const EXPORT_COLUMNS = [
    { header: 'Label/Kode Barang', accessor: (r: BarangRusak) => r.labelBarang },
    { header: 'Nama Barang', accessor: (r: BarangRusak) => r.namaBarang },
    { header: 'Keterangan', accessor: (r: BarangRusak) => r.keterangan ?? '-' },
    { header: 'Pelapor', accessor: (r: BarangRusak) => r.pelapor ?? '-' },
    { header: 'Status', accessor: (r: BarangRusak) => r.status },
    { header: 'Pemeriksa', accessor: (r: BarangRusak) => r.pemeriksa ?? '-' },
  ];
  const PDF_META = {
    title: 'Rekap Data Gudang — Barang Rusak',
    subtitle: 'Menu Utama / Barang Rusak',
    description: 'Daftar laporan barang rusak/retur beserta status hasil pengecekan fisik.',
  };

  function handleExport(): void {
    requestExport(rows, EXPORT_COLUMNS, 'daftar-barang-rusak', PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, EXPORT_COLUMNS, { ...PDF_META, generatedBy: user?.fullName });
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
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
      default:
        return;
    }
  }

  const columns: DataTableColumn<BarangRusak>[] = [
    { key: 'label', header: 'Label / Kode', render: (row) => <span className="font-mono text-xs">{row.labelBarang}</span> },
    { key: 'nama', header: 'Nama Barang', render: (row) => row.namaBarang },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan || '-' },
    { key: 'pelapor', header: 'Pelapor', render: (row) => row.pelapor ?? '-' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = BARANG_RUSAK_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {isStaff && row.status === 'pengecekan' ? (
            <>
              <button
                type="button"
                onClick={() => handleInspeksi(row, 'retur')}
                title="Tandai Bisa Diretur"
                className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInspeksi(row, 'rusak')}
                title="Tandai Rusak"
                className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {row.status === 'pengecekan' ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Edit"
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
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
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Barang Rusak" breadcrumb="Manajemen / Barang Rusak">
      <StatsRow
        stats={[
          { id: 'pengecekan', label: 'Menunggu Pengecekan', value: rows.filter((r) => r.status === 'pengecekan').length },
          { id: 'retur', label: 'Bisa Diretur', value: rows.filter((r) => r.status === 'retur').length },
          { id: 'rusak', label: 'Rusak', value: rows.filter((r) => r.status === 'rusak').length },
          { id: 'total', label: 'Total Laporan', value: rows.length },
        ]}
      />
      <DataTable
        title="Daftar Laporan Barang Rusak"
        description="Laporan barang rusak/retur — status default 'Menunggu Pengecekan' sampai diperiksa fisik oleh Admin/Super Admin"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="barang_rusak"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Laporan Barang Rusak' : 'Lapor Barang Rusak'}
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
          label="Label / Kode Barang"
          value={form.labelBarang ?? ''}
          onChange={(event) => setForm({ ...form, labelBarang: event.target.value })}
          placeholder="mis. BRG-0001 atau BBU-RSD-0001"
        />
        <Input
          label="Nama Barang"
          value={form.namaBarang ?? ''}
          onChange={(event) => setForm({ ...form, namaBarang: event.target.value })}
        />
        <Input
          label="Keterangan (opsional)"
          value={form.keterangan ?? ''}
          onChange={(event) => setForm({ ...form, keterangan: event.target.value })}
          placeholder="Kondisi kerusakan yang terlihat"
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}

export function BarangRusakContent(): React.JSX.Element {
  return <BarangRusakBody />;
}
