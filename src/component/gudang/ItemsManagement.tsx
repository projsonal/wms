'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock, CheckCircle2, XCircle } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField, CurrencyField, SelectWithCreate } from '@/component/ui/FormControls';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { itemsApi, kategoriApi, satuanApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { ITEM_STATUS_META } from '@/lib/utils/status';
import type { Item } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<Item> = {
  name: '',
  sku: '',
  categoryId: '',
  unitId: '',
  stock: 0,
  minStock: 0,
  price: 0,
  deskripsi: '',
};

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';

export function ItemsManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canEditItem = isStaff || can('kelola_barang', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('items', itemsApi);
  const { data: kategoriList, mutate: mutateKategori } = useSWR('kategori-list', () => kategoriApi.list());
  const { data: satuanList, mutate: mutateSatuan } = useSWR('satuan-list', () => satuanApi.list());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Item>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Item): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      name: row.name,
      sku: row.sku,
      categoryId: row.categoryId ?? '',
      unitId: row.unitId ?? '',
      minStock: row.minStock,
      price: row.price,
      weightGram: row.weightGram,
      deskripsi: row.deskripsi ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.categoryId || !form.unitId) {
      toast.error('Kategori dan Satuan wajib dipilih.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await itemsApi.update(editingId, form);
        toast.success('Barang berhasil diperbarui.');
      } else {
        await itemsApi.create(form);
        toast.success('Barang baru berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan barang.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: Item): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Barang',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await itemsApi.remove(row.id);
      toast.success('Barang berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus barang.'));
    }
  }

  async function handleToggleProtect(row: Item): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Data Ini?' : 'Buka Kunci Data Ini?',
      message: willProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await itemsApi.setProtected(row.id, willProtect);
      toast.success(willProtect ? 'Data dikunci (Protect).' : 'Data dibuka kuncinya.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleApprove(row: Item): Promise<void> {
    const ok = await confirm({
      title: 'Setujui Barang Ini?',
      message: `Barang "${row.name}" yang diajukan admin akan langsung aktif dan tampil untuk semua role.`,
      confirmLabel: 'Ya, Setujui',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await itemsApi.approve(row.id);
      toast.success('Barang berhasil disetujui.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyetujui barang.'));
    }
  }

  async function handleReject(row: Item): Promise<void> {
    const reason = window.prompt(`Alasan menolak "${row.name}"? (wajib diisi)`);
    if (!reason || !reason.trim()) {
      if (reason !== null) toast.error('Alasan penolakan wajib diisi.');
      return;
    }
    try {
      await itemsApi.reject(row.id, reason.trim());
      toast.success('Barang berhasil ditolak.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menolak barang.'));
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

  const ITEM_EXPORT_COLUMNS = [
    { header: 'SKU', accessor: (r: Item) => r.sku },
    { header: 'Nama Barang', accessor: (r: Item) => r.name },
    { header: 'Kategori', accessor: (r: Item) => r.category },
    { header: 'Stok', accessor: (r: Item) => r.stock },
    { header: 'Satuan', accessor: (r: Item) => r.unit },
    { header: 'Stok Minimum', accessor: (r: Item) => r.minStock },
    { header: 'Harga Beli', accessor: (r: Item) => r.price },
    { header: 'Status', accessor: (r: Item) => r.status },
    { header: 'Terakhir Update', accessor: (r: Item) => r.updatedAt },
  ];
  const ITEM_PDF_META = {
    title: 'Rekap Data Gudang — Kelola Barang',
    subtitle: 'Pengelolaan / Kelola Barang',
    description: 'Daftar seluruh SKU barang yang terdaftar di gudang, lengkap dengan kategori, stok berjalan, satuan, dan status ketersediaan per tanggal cetak.',
  };

  function handleExport(): void {
    requestExport(rows, ITEM_EXPORT_COLUMNS, 'daftar-barang', ITEM_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, ITEM_EXPORT_COLUMNS, { ...ITEM_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: Item[]): Promise<void> {
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

  async function handleBulkDelete(selectedRows: Item[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Barang Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => itemsApi.remove(r.id)));
      toast.success(`${selectedRows.length} barang berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus (mungkin ada yang di-Protect).'));
    }
  }

  async function handleBulkProtect(selectedRows: Item[]): Promise<void> {
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
      await Promise.all(selectedRows.map((r) => itemsApi.setProtected(r.id, shouldProtect)));
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

  const columns: DataTableColumn<Item>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Item) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Item>,
        ]
      : []),
    { key: 'sku', header: 'SKU', render: (row) => row.sku },
    { key: 'name', header: 'Nama Barang', render: (row) => row.name },
    { key: 'category', header: 'Kategori', render: (row) => row.category },
    {
      key: 'stock',
      header: 'Stok',
      align: 'right',
      render: (row) => `${formatNumber(row.stock)} ${row.unit}`,
    },
    {
      key: 'price',
      header: 'Harga',
      align: 'right',
      render: (row) => (row.isProtected && !isStaff ? '••••••' : formatCurrency(row.price)),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = ITEM_STATUS_META[row.status];
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label={meta.label} variant={meta.variant} />
            {row.approvalStatus === 'menunggu' ? (
              <Badge label="Menunggu Persetujuan" variant="warning" />
            ) : null}
            {row.approvalStatus === 'ditolak' ? <Badge label="Ditolak" variant="danger" /> : null}
            {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci" /> : null}
          </div>
        );
      },
    },
    { key: 'updated', header: 'Update', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {isStaff && row.approvalStatus === 'menunggu' && row.submittedByUserId !== user?.id ? (
            <>
              <button
                type="button"
                onClick={() => handleApprove(row)}
                title="Setujui"
                className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleReject(row)}
                title="Tolak"
                className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => openEditModal(row)}
            title="Edit"
            className={`rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark ${canEditItem ? '' : 'cursor-not-allowed opacity-30'}`}
            disabled={!canEditItem}
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
    <PageShell title="Kelola Barang" breadcrumb="Pengelolaan / Kelola Barang">
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel. */}
      <DataTable
        title="Daftar Barang"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete/Protect di atas.`
            : 'Seluruh SKU yang terdaftar di gudang'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="kelola_barang"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Barang' : 'Tambah Barang'}
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
          <SelectWithCreate
            label="Kategori"
            value={form.categoryId ?? ''}
            onChange={(value) => setForm({ ...form, categoryId: value })}
            placeholder="Pilih kategori"
            options={(kategoriList ?? []).map((k) => ({ label: k.nama, value: String(k.id) }))}
            createLabel="+ Tambah Kategori Baru"
            onCreate={async (nama) => {
              const created = await kategoriApi.create(nama);
              await mutateKategori();
              return { label: created.nama, value: String(created.id) };
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Stok Minimum"
            value={form.minStock ?? 0}
            onValueChange={(value) => setForm({ ...form, minStock: value })}
          />
          <SelectWithCreate
            label="Satuan"
            value={form.unitId ?? ''}
            onChange={(value) => setForm({ ...form, unitId: value })}
            placeholder="Pilih satuan"
            options={(satuanList ?? []).map((s) => ({ label: `${s.nama} (${s.singkatan})`, value: String(s.id) }))}
            createLabel="+ Tambah Satuan Baru"
            secondaryFieldLabel="Singkatan"
            onCreate={async (nama, singkatan) => {
              const created = await satuanApi.create(nama, singkatan ?? nama.slice(0, 3));
              await mutateSatuan();
              return { label: `${created.nama} (${created.singkatan})`, value: String(created.id) };
            }}
          />
        </div>
        <CurrencyField
          label="Harga Beli"
          value={form.price ?? 0}
          onValueChange={(value) => setForm({ ...form, price: value })}
        />
        <div>
          <Input
            label="Berat per Satuan (kg, opsional)"
            placeholder="0.06"
            inputMode="decimal"
            value={
              form.weightGram !== undefined && form.weightGram !== null
                ? String(form.weightGram / 1000)
                : ''
            }
            onChange={(event) => {
              const raw = event.target.value.replace(',', '.');
              if (raw === '') {
                setForm({ ...form, weightGram: undefined });
                return;
              }
              const kg = Number(raw);
              setForm({ ...form, weightGram: Number.isNaN(kg) ? undefined : Math.round(kg * 1000) });
            }}
          />
          <p className="mt-1 text-xs text-textMuted">
            Contoh: 0.06 untuk 60 gram, 1.5 untuk 1,5 kg. Dipakai menampilkan berat di resi pengiriman.
          </p>
        </div>
        <Input
          label="Deskripsi"
          value={form.deskripsi ?? ''}
          onChange={(event) => setForm({ ...form, deskripsi: event.target.value })}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
