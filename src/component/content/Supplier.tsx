'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { suppliersApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Supplier } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<Supplier> = {
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  courierPartners: [],
  address: '',
  npwp: '',
  notes: '',
};

/** Kurir yang umum dipakai di Indonesia — checkbox cepat. Kurir lain di
 * luar daftar ini tetap bisa ditambah lewat input teks bebas di sampingnya. */
const COMMON_COURIERS = ['JNE', 'J&T', 'SiCepat', 'AnterAja', 'Lalamove', 'GoSend', 'Ninja Xpress'];

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';


export function SupplierContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('suppliers', suppliersApi);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Supplier): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      code: row.code ?? '',
      name: row.name,
      contactPerson: row.contactPerson,
      phone: row.phone,
      courierPartners: row.courierPartners,
      address: row.address,
      npwp: row.npwp ?? '',
      notes: row.notes ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    try {
      if (editingId) {
        await suppliersApi.update(editingId, form);
        toast.success('Supplier berhasil diperbarui.');
      } else {
        await suppliersApi.create(form);
        toast.success('Supplier baru berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan supplier.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: Supplier): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Supplier',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await suppliersApi.remove(row.id);
      toast.success('Supplier berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus supplier.'));
    }
  }

  async function handleToggleProtect(row: Supplier): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Data Ini?' : 'Buka Kunci Data Ini?',
      message: willProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await suppliersApi.setProtected(row.id, willProtect);
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

  const SUPPLIER_EXPORT_COLUMNS = [
    { header: 'Kode', accessor: (r: Supplier) => r.code ?? '-' },
    { header: 'Nama Supplier', accessor: (r: Supplier) => r.name },
    { header: 'PIC', accessor: (r: Supplier) => r.contactPerson },
    { header: 'No. Telepon', accessor: (r: Supplier) => r.phone },
    { header: 'Kerjasama Kurir', accessor: (r: Supplier) => r.courierPartners.join(', ') || '-' },
    { header: 'Alamat', accessor: (r: Supplier) => r.address },
    { header: 'Total Order', accessor: (r: Supplier) => r.totalOrders },
    { header: 'Rating', accessor: (r: Supplier) => r.rating },
    { header: 'Status', accessor: (r: Supplier) => r.status },
  ];
  const SUPPLIER_PDF_META = {
    title: 'Rekap Data Gudang — Daftar Supplier',
    subtitle: 'Menu Utama / Supplier',
    description: 'Daftar seluruh supplier terdaftar beserta kontak PIC, riwayat jumlah order, dan status keaktifannya.',
  };

  function handleExport(): void {
    requestExport(rows, SUPPLIER_EXPORT_COLUMNS, 'daftar-supplier', SUPPLIER_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, SUPPLIER_EXPORT_COLUMNS, { ...SUPPLIER_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: Supplier[]): Promise<void> {
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

  async function handleBulkDelete(selectedRows: Supplier[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Supplier Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => suppliersApi.remove(r.id)));
      toast.success(`${selectedRows.length} supplier berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus (mungkin ada yang di-Protect).'));
    }
  }

  async function handleBulkProtect(selectedRows: Supplier[]): Promise<void> {
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
      await Promise.all(selectedRows.map((r) => suppliersApi.setProtected(r.id, shouldProtect)));
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

  const columns: DataTableColumn<Supplier>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Supplier) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Supplier>,
        ]
      : []),
    { key: 'name', header: 'Nama Supplier', render: (row) => row.name },
    {
      key: 'contact',
      header: 'Kontak',
      render: (row) => (row.isProtected && !isStaff ? '••••••' : row.contactPerson),
    },
    {
      key: 'phone',
      header: 'No. Telepon',
      render: (row) => (row.isProtected && !isStaff ? '••••••' : row.phone),
    },
    {
      key: 'courier',
      header: 'Kerjasama Kurir',
      render: (row) => {
        if (row.isProtected && !isStaff) return '••••••';
        if (row.courierPartners.length === 0) return '-';
        return (
          <div className="flex flex-wrap gap-1">
            {row.courierPartners.map((c) => (
              <span
                key={c}
                className="rounded-full bg-neutralBg px-2 py-0.5 text-xs font-medium text-textMuted"
              >
                {c}
              </span>
            ))}
          </div>
        );
      },
    },
    { key: 'orders', header: 'Total Order', align: 'right', render: (row) => row.totalOrders },
    { key: 'rating', header: 'Rating', align: 'right', render: (row) => row.rating.toFixed(1) },
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
    <PageShell title="Supplier" breadcrumb="Menu Utama / Supplier">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Supplier', value: rows.length },
          {
            id: 'aktif',
            label: 'Supplier Aktif',
            value: rows.filter((r) => r.status === 'aktif').length,
          },
          {
            id: 'orders',
            label: 'Total Order',
            value: rows.reduce((sum, r) => sum + r.totalOrders, 0),
          },
          {
            id: 'rating',
            label: 'Rating Rata-rata',
            value: (rows.reduce((sum, r) => sum + r.rating, 0) / (rows.length || 1)).toFixed(1),
          },
        ]}
      />
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel. */}
      <DataTable
        title="Daftar Supplier"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete/Protect di atas.`
            : 'Mitra pemasok barang aktif maupun nonaktif'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="supplier"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Supplier' : 'Tambah Supplier'}
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
            label="Kode Supplier"
            value={form.code ?? ''}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            placeholder="SUP-0001"
          />
          <Input
            label="Nama Supplier"
            value={form.name ?? ''}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <Input
          label="PIC / Kontak"
          value={form.contactPerson ?? ''}
          onChange={(event) => setForm({ ...form, contactPerson: event.target.value })}
        />
        <Input
          label="No. Telepon"
          value={form.phone ?? ''}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">Kerjasama Kurir</span>
          <p className="text-xs text-textMuted">
            Pilih kurir yang dipakai supplier ini untuk mengirim barang ke lokasi tujuan — dipakai
            menghitung Total Order & Rating otomatis dari data pengiriman.
          </p>
          <div className="flex flex-wrap gap-3">
            {COMMON_COURIERS.map((courier) => {
              const checked = (form.courierPartners ?? []).includes(courier);
              return (
                <label key={courier} className="flex items-center gap-1.5 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const current = form.courierPartners ?? [];
                      setForm({
                        ...form,
                        courierPartners: checked
                          ? current.filter((c) => c !== courier)
                          : [...current, courier],
                      });
                    }}
                    className="h-4 w-4"
                  />
                  {courier}
                </label>
              );
            })}
          </div>
          <Input
            label="Kurir lain (opsional, pisahkan dengan koma)"
            placeholder="mis. Wahana, ID Express"
            value={(form.courierPartners ?? []).filter((c) => !COMMON_COURIERS.includes(c)).join(', ')}
            onChange={(event) => {
              const custom = event.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const commonSelected = (form.courierPartners ?? []).filter((c) => COMMON_COURIERS.includes(c));
              setForm({ ...form, courierPartners: [...commonSelected, ...custom] });
            }}
          />
        </div>
        <Input
          label="Alamat"
          value={form.address ?? ''}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="NPWP (opsional)"
            value={form.npwp ?? ''}
            onChange={(event) => setForm({ ...form, npwp: event.target.value })}
          />
          <Input
            label="Catatan (opsional)"
            value={form.notes ?? ''}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </div>
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
