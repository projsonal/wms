'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { warehousesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatNumber } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Warehouse } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<Warehouse> = { name: '', code: '', address: '', picName: '', phone: '', capacity: 0 };

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';


export function WarehouseListContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('warehouses', warehousesApi);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Warehouse>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalCapacity = rows.reduce((sum, wh) => sum + wh.capacity, 0);
  const totalUsed = rows.reduce((sum, wh) => sum + wh.usedCapacity, 0);
  const totalItems = rows.reduce((sum, wh) => sum + wh.totalItems, 0);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Warehouse): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code ?? '',
      address: row.address,
      picName: row.picName,
      phone: row.phone ?? '',
      capacity: row.capacity,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    // Backend mewajibkan "kode" (GudangRequest.Kode validate:"required") —
    // tanpa ini, Create/Update selalu ditolak validasi (dulu field ini
    // tidak ada di form sama sekali, sehingga Tambah/Ubah Gudang SELALU
    // gagal dengan pesan generik "validasi gagal").
    if (!form.name?.trim()) {
      toast.error('Nama gudang wajib diisi.');
      return;
    }
    if (!form.code?.trim()) {
      toast.error('Kode gudang wajib diisi (mis. BBU, BDG1).');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await warehousesApi.update(editingId, form);
        toast.success('Gudang berhasil diperbarui.');
      } else {
        await warehousesApi.create(form);
        toast.success('Gudang baru berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan gudang.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: Warehouse): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Gudang',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await warehousesApi.remove(row.id);
      toast.success('Gudang berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus gudang.'));
    }
  }

  async function handleToggleProtect(row: Warehouse): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Data Ini?' : 'Buka Kunci Data Ini?',
      message: willProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await warehousesApi.setProtected(row.id, willProtect);
      toast.success(willProtect ? 'Data dikunci (Protect).' : 'Data dibuka kuncinya.');
      await mutate();
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

  const WAREHOUSE_EXPORT_COLUMNS = [
    { header: 'Nama Gudang', accessor: (r: Warehouse) => r.name },
    { header: 'Kode', accessor: (r: Warehouse) => r.code },
    { header: 'Alamat / Koordinat', accessor: (r: Warehouse) => r.address },
    { header: 'PIC', accessor: (r: Warehouse) => r.picName },
    { header: 'Kapasitas Terpakai', accessor: (r: Warehouse) => r.usedCapacity },
    { header: 'Total Kapasitas', accessor: (r: Warehouse) => r.capacity },
    { header: 'Status', accessor: (r: Warehouse) => r.status },
  ];
  const WAREHOUSE_PDF_META = {
    title: 'Rekap Data Gudang — Daftar Gudang',
    subtitle: 'Menu Utama / WMS',
    description: 'Persebaran gudang operasional beserta penanggung jawab (PIC), kapasitas total, dan kapasitas terpakai per lokasi.',
  };

  function handleExport(): void {
    requestExport(rows, WAREHOUSE_EXPORT_COLUMNS, 'daftar-gudang', WAREHOUSE_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, WAREHOUSE_EXPORT_COLUMNS, { ...WAREHOUSE_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: Warehouse[]): Promise<void> {
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

  async function handleBulkDelete(selectedRows: Warehouse[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Gudang Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => warehousesApi.remove(r.id)));
      toast.success(`${selectedRows.length} gudang berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus (mungkin ada yang di-Protect).'));
    }
  }

  async function handleBulkProtect(selectedRows: Warehouse[]): Promise<void> {
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
      await Promise.all(selectedRows.map((r) => warehousesApi.setProtected(r.id, shouldProtect)));
      toast.success(shouldProtect ? 'Data terpilih dikunci.' : 'Data terpilih dibuka kuncinya.');
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));

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

  const columns: DataTableColumn<Warehouse>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Warehouse) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Warehouse>,
        ]
      : []),
    { key: 'name', header: 'Nama Gudang', render: (row) => row.name },
    { key: 'code', header: 'Kode', render: (row) => row.code },
    {
      key: 'address',
      header: 'Alamat',
      render: (row) => (row.isProtected && !isStaff ? '••••••' : row.address),
    },
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
        return (
          <div className="flex items-center gap-1.5">
            {meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status}
            {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci" /> : null}
          </div>
        );
      },
    },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
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
    },
  ];

  return (
    <PageShell title="Warehouse Management System (WMS)" breadcrumb="Menu Utama / WMS">
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
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel. */}
      <DataTable
        title="Daftar Gudang"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete/Protect di atas.`
            : 'Persebaran gudang beserta kapasitas & PIC'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="manajemen_gudang"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Gudang' : 'Tambah Gudang'}
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
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nama Gudang"
            value={form.name ?? ''}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Kode Gudang"
            placeholder="mis. BBU, BDG1"
            value={form.code ?? ''}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          />
        </div>
        <Input
          label="Alamat"
          placeholder="Contoh: Jl. Manggahang No. 12, Bandung"
          value={form.address ?? ''}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Latitude (opsional)"
            placeholder="-7.0209099"
            inputMode="decimal"
            value={form.latitude !== undefined ? String(form.latitude) : ''}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              setForm({ ...form, latitude: raw === '' || Number.isNaN(parsed) ? undefined : parsed });
            }}
          />
          <Input
            label="Longitude (opsional)"
            placeholder="107.6495411"
            inputMode="decimal"
            value={form.longitude !== undefined ? String(form.longitude) : ''}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              setForm({ ...form, longitude: raw === '' || Number.isNaN(parsed) ? undefined : parsed });
            }}
          />
        </div>
        <p className="-mt-2 text-xs text-textMuted">
          Isi Latitude/Longitude supaya gudang ini muncul sebagai titik di peta Pickup & Dropoff. Bisa
          disalin dari Google Maps (klik kanan lokasi → salin koordinat).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="PIC (Penanggung Jawab)"
            placeholder="Nama PIC gudang"
            value={form.picName ?? ''}
            onChange={(event) => setForm({ ...form, picName: event.target.value })}
          />
          <Input
            label="No. Telepon Gudang"
            placeholder="0812xxxxxxx"
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <NumberField
          label="Kapasitas Total (unit)"
          value={form.capacity ?? 0}
          onValueChange={(value) => setForm({ ...form, capacity: value })}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
