'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock, CheckCircle2, XCircle, Tags, UserCog } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField, CurrencyField, Select, SelectWithCreate } from '@/component/ui/FormControls';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { itemsApi, kategoriApi, satuanApi, usersApi } from '@/lib/api/modules';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { printSkuLabels } from '@/lib/utils/print-sku-label';
import { ITEM_STATUS_META } from '@/lib/utils/status';
import { resolveEquipmentAbbreviation } from '@/lib/utils/equipment-abbreviations';
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
  isSerialized: false,
  merek: '',
  tipe: '',
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

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, error, mutate, serverPagination } = useServerPaginatedList(
    'items',
    itemsApi,
    { search: searchTerm || undefined },
  );
  const { data: kategoriList, mutate: mutateKategori } = useSWR('kategori-list', () => kategoriApi.list());
  const { data: satuanList, mutate: mutateSatuan } = useSWR('satuan-list', () => satuanApi.list());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Item>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [beratKgText, setBeratKgText] = useState('');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: usersRes } = useSWR('admin-users-for-delegasi', () => usersApi.list({ pageSize: 200 }));
  const adminOptions = (usersRes?.data ?? [])
    .filter((u) => u.role === 'admin')
    .map((u) => ({ label: `${u.name} (${u.username})`, value: u.id }));
  const [delegatingRow, setDelegatingRow] = useState<Item | null>(null);
  const [delegateUserId, setDelegateUserId] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);

  function openDelegateModal(row: Item): void {
    setDelegatingRow(row);
    setDelegateUserId(row.delegatedToUserId ? String(row.delegatedToUserId) : '');
  }

  async function handleDelegate(): Promise<void> {
    if (!delegatingRow || !delegateUserId) {
      toast.error('Pilih admin tujuan delegasi dulu.');
      return;
    }
    setIsDelegating(true);
    try {
      await itemsApi.delegasikan(delegatingRow.id, delegateUserId);
      toast.success('Pengajuan berhasil didelegasikan — admin terpilih sekarang bisa mengecek & memproses baris ini.');
      setDelegatingRow(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mendelegasikan pengajuan.'));
    } finally {
      setIsDelegating(false);
    }
  }

  const [skuMode, setSkuMode] = useState<'otomatis' | 'manual'>('otomatis');
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

  const [skuAvailability, setSkuAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  async function generateSku(categoryId?: string, tipe?: string, merek?: string, beratGram?: number): Promise<void> {
    setIsGeneratingSku(true);
    try {
      const { sku } = await itemsApi.nextSku(categoryId || undefined, tipe || undefined, merek || undefined, beratGram);
      setForm((prev) => ({ ...prev, sku }));
      setSkuAvailability('idle'); // hasil generate otomatis sudah pasti belum dipakai (dihitung dari data terbaru)
    } catch {
      // Diam-diam gagal (mis. lagi offline) — operator tetap bisa isi SKU
      // manual, tidak perlu menghalangi seluruh form cuma karena saran
      // otomatis gagal dimuat.
    } finally {
      setIsGeneratingSku(false);
    }
  }

  function handleCategoryChangeForSku(categoryId: string): void {
    setForm((prev) => ({ ...prev, categoryId }));
    if (skuMode === 'otomatis' && !editingId) {
      generateSku(categoryId, form.tipe, form.merek, form.weightGram);
    }
  }

  function handleTipeChangeForSku(tipe: string): void {
    setForm((prev) => ({ ...prev, tipe }));
    if (skuMode === 'otomatis' && !editingId) {
      generateSku(form.categoryId, tipe, form.merek, form.weightGram);
    }
  }

  function handleMerekChangeForSku(merek: string): void {
    setForm((prev) => ({ ...prev, merek }));
    if (skuMode === 'otomatis' && !editingId) {
      generateSku(form.categoryId, form.tipe, merek, form.weightGram);
    }
  }

  function handleBeratChangeForSku(beratGram: number | undefined): void {
    if (skuMode === 'otomatis' && !editingId) {
      generateSku(form.categoryId, form.tipe, form.merek, beratGram);
    }
  }

  useEffect(() => {
    if (skuMode !== 'manual' || !isModalOpen) return;
    const sku = form.sku?.trim();
    if (!sku) {
      setSkuAvailability('idle');
      return;
    }
    setSkuAvailability('checking');
    const timer = window.setTimeout(() => {
      itemsApi
        .checkSku(sku, editingId ?? undefined)
        .then((res) => setSkuAvailability(res.available ? 'available' : 'taken'))
        .catch(() => setSkuAvailability('idle'));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [form.sku, skuMode, isModalOpen, editingId]);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBeratKgText('');
    setSkuMode('otomatis');
    setSkuAvailability('idle');
    setIsModalOpen(true);
    generateSku();
  }

  function openEditModal(row: Item): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setSkuMode('manual');
    setForm({
      name: row.name,
      sku: row.sku,
      categoryId: row.categoryId ?? '',
      unitId: row.unitId ?? '',
      stock: row.stock,
      minStock: row.minStock,
      price: row.price,
      weightGram: row.weightGram,
      deskripsi: row.deskripsi ?? '',
      isSerialized: row.isSerialized ?? false,
      merek: row.merek ?? '',
      tipe: row.tipe ?? '',
    });
    setBeratKgText(
      row.weightGram !== undefined && row.weightGram !== null ? String(row.weightGram / 1000) : '',
    );
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.categoryId || !form.unitId) {
      toast.error('Kategori dan Satuan wajib dipilih.');
      return;
    }
    if (!form.sku?.trim()) {
      toast.error('SKU wajib diisi — pilih kategori dulu untuk saran otomatis, atau isi manual.');
      return;
    }
    if (isGeneratingSku) {
      toast.error('Tunggu saran SKU selesai dibuat sebentar lagi.');
      return;
    }
    if (skuMode === 'manual' && skuAvailability === 'taken') {
      toast.error('SKU ini sudah dipakai barang lain — ganti dulu sebelum menyimpan.');
      return;
    }

    if (!editingId && user?.role === 'karyawan') {
      const ok = await confirm({
        title: 'Tambah Data Barang?',
        message:
          'Apakah kamu yakin ingin tambah data ini? Setelah dikirim, data TIDAK langsung aktif — super admin akan mengecek fisik barang (kondisi, kecocokan serial number, dan kode barang) sebelum disetujui.',
        confirmLabel: 'Ya, Ajukan',
        variant: 'default',
      });
      if (!ok) return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await itemsApi.update(editingId, form);
        toast.success('Barang berhasil diperbarui.');
      } else {
        const created = await itemsApi.create(form);
        if (created.approvalStatus === 'menunggu') {
          toast.success(
            'Pengajuan berhasil dikirim. Silakan tunggu — super admin akan melakukan pengecekan fisik & serial number sebelum data ini disetujui dan tampil untuk semua orang.',
          );
        } else {
          toast.success('Barang baru berhasil ditambahkan.');
        }
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
      message: `Barang "${row.name}" yang diajukan akan langsung aktif dan tampil untuk semua role. Pastikan sudah dicek fisik (kondisi barang, kecocokan serial number & kode barang) sebelum menyetujui.`,
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
    const reason = window.prompt(
      `Alasan menolak "${row.name}"? (wajib diisi — jelaskan apa yang perlu dicek ulang, mis. serial number tidak sesuai fisik)`,
    );
    if (!reason?.trim()) {
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
    { header: 'Merek', accessor: (r: Item) => r.merek || '-' },
    { header: 'Tipe', accessor: (r: Item) => r.tipe || '-' },
    { header: 'Kategori', accessor: (r: Item) => r.category },
    { header: 'Stok', accessor: (r: Item) => r.stock },
    { header: 'Satuan', accessor: (r: Item) => r.unit },
    { header: 'Stok Minimum', accessor: (r: Item) => r.minStock },
    { header: 'Harga Beli', accessor: (r: Item) => r.price },
    { header: 'Status', accessor: (r: Item) => r.status },
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

  async function handlePrintLabelOne(row: Item): Promise<void> {
    const input = window.prompt(`Cetak berapa lembar label untuk "${row.sku}"?`, '1');
    if (input === null) return;
    const qty = Math.max(1, Math.round(Number(input)) || 1);
    try {
      await printSkuLabels(
        [{ sku: row.sku, name: row.name, merek: row.merek, tipe: row.tipe, qty }],
        user?.fullName,
      );
    } catch {
      toast.error('Gagal membuat label — coba lagi.');
    }
  }

  async function handleBulkPrintLabels(selectedRows: Item[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa SKU yang labelnya mau dicetak.');
      return;
    }
    const input = window.prompt(`Cetak berapa lembar label per SKU (${selectedRows.length} SKU terpilih)?`, '1');
    if (input === null) return;
    const qty = Math.max(1, Math.round(Number(input)) || 1);
    try {
      await printSkuLabels(
        selectedRows.map((r) => ({ sku: r.sku, name: r.name, merek: r.merek, tipe: r.tipe, qty })),
        user?.fullName,
      );
    } catch {
      toast.error('Gagal membuat label — coba lagi.');
    }
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
    const actions: Partial<Record<TableRowAction, () => void | Promise<void>>> = {
      add: openCreateModal,
      export: handleExport,
      print: handlePrint,
      modify: () => {
        setIsBulkMode((prev) => !prev);
        setSelectedIds(new Set());
      },
      change: () => handleBulkChange(selectedRows),
      delete: () => handleBulkDelete(selectedRows),
      protect: () => handleBulkProtect(selectedRows),
    };
    await actions[action]?.();
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
    { key: 'merek', header: 'Merek', render: (row) => row.merek || '-' },
    {
      key: 'tipe',
      header: 'Tipe',
      render: (row) => {
        if (!row.tipe) return '-';

        if (!row.isSerialized) return row.tipe;
        return resolveEquipmentAbbreviation(row.tipe) ?? row.tipe;
      },
    },
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
              <Badge
                label={row.delegatedToName ? `Menunggu — didelegasikan ke ${row.delegatedToName}` : 'Menunggu Persetujuan'}
                variant="warning"
              />
            ) : null}
            {row.approvalStatus === 'ditolak' ? (
              <Badge
                label="Ditolak"
                variant="danger"
                title={
                  row.catatanApproval
                    ? `Alasan: ${row.catatanApproval}, periksa ulang datanya sebelum mengajukan lagi.`
                    : 'Periksa ulang datanya sebelum mengajukan lagi.'
                }
              />
            ) : null}
            {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci" /> : null}
          </div>
        );
      },
    },
    { key: 'created', header: 'Tanggal Dibuat', render: (row) => formatDate(row.createdAt) },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {(isSuperAdmin || row.delegatedToUserId === user?.id) &&
          row.approvalStatus === 'menunggu' &&
          row.submittedByUserId !== user?.id ? (
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
          {isSuperAdmin && row.approvalStatus === 'menunggu' ? (
            <button
              type="button"
              onClick={() => openDelegateModal(row)}
              title={row.delegatedToName ? `Didelegasikan ke ${row.delegatedToName} — ubah` : 'Delegasikan (Assign) ke admin'}
              className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
            >
              <UserCog className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handlePrintLabelOne(row)}
            title="Cetak Label Barcode (SKU)"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Tags className="h-3.5 w-3.5" />
          </button>
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

      <DataTable
        title="Daftar Barang"
        description={
          isBulkMode
            ? `Mode Modify aktif ${selectedIds.size}. Silakan Pilih data per baris lalu gunakan Change/Delete/Protect di atas.`
            : 'Seluruh SKU yang terdaftar di gudang'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="kelola_barang"
        serverPagination={serverPagination}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {isBulkMode ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleBulkPrintLabels(rows.filter((r) => selectedIds.has(r.id)))}
                disabled={selectedIds.size === 0}
              >
                <Tags className="mr-1.5 h-3.5 w-3.5" /> Cetak Label Terpilih
              </Button>
            ) : null}
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari SKU/nama barang......" />
          </div>
        }
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
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-text">SKU</span>
              <div className="flex items-center gap-1 rounded-full bg-neutralBg p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setSkuMode('otomatis');
                    generateSku(form.categoryId, form.tipe, form.merek, form.weightGram);
                  }}
                  className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                    skuMode === 'otomatis' ? 'bg-accent text-white' : 'text-textMuted'
                  }`}
                >
                  Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setSkuMode('manual')}
                  className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                    skuMode === 'manual' ? 'bg-accent text-white' : 'text-textMuted'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>
            <Input
              value={isGeneratingSku ? 'Membuat SKU...' : (form.sku ?? '')}
              onChange={(event) => setForm({ ...form, sku: event.target.value })}
              disabled={skuMode === 'otomatis' || isGeneratingSku}
              placeholder={skuMode === 'otomatis' ? 'Pilih kategori dulu untuk saran SKU' : 'mis. TEK-ONT-HUA-S-0001'}
            />
            {skuMode === 'otomatis' ? (
              <p className="mt-1 text-xs text-textMuted">
                Format &quot;KATEGORI-TIPE-MEREK-UKURAN-nomor&quot; (mis. Teknologi + ONT + Huawei + berat
                800gr → &quot;TEK-ONT-HUA-S-0007&quot;). Komponen yang datanya belum diisi (Tipe/Merek/Berat)
                otomatis dilewati. Pindah ke Manual kalau mau tentukan sendiri.
              </p>
            ) : (
              <>
                {skuAvailability === 'checking' && (
                  <p className="mt-1 text-xs text-textMuted">Mengecek ketersediaan SKU...</p>
                )}
                {skuAvailability === 'taken' && (
                  <p className="mt-1 text-xs text-dangerText">SKU ini sudah dipakai barang lain — pilih SKU lain.</p>
                )}
                {skuAvailability === 'available' && (
                  <p className="mt-1 text-xs text-successText">SKU tersedia.</p>
                )}
              </>
            )}
          </div>
          <SelectWithCreate
            label="Kategori"
            value={form.categoryId ?? ''}
            onChange={handleCategoryChangeForSku}
            placeholder="Pilih kategori"
            options={(kategoriList ?? []).map((k) => ({ label: k.nama, value: String(k.id) }))}
            createLabel="+ Tambah Kategori Baru"
            onCreate={async (nama) => {
              const ok = await confirm({
                title: 'Tambah Kategori Baru',
                message: `Tambahkan kategori baru "${nama}"? Apakah kamu yakin untuk melanjutkan?`,
                confirmLabel: 'Ya, Tambahkan',
                variant: 'default',
              });
              if (!ok) throw new Error('Dibatalkan.');
              const created = await kategoriApi.create(nama);
              await mutateKategori();
              return { label: created.nama, value: String(created.id) };
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <NumberField
              label={editingId ? 'Stok (koreksi manual)' : 'Stok Awal'}
              value={form.stock ?? 0}
              onValueChange={(value) => setForm({ ...form, stock: value })}
            />
            <p className="mt-1 text-xs text-textMuted">
              {editingId
                ? 'Nilai ABSOLUT (menimpa stok saat ini) — cuma untuk koreksi manual (mis. hasil stock opname). Untuk transaksi normal, pakai Barang Masuk/Keluar supaya riwayatnya tercatat.'
                : 'Isi kalau barang ini sudah punya stok fisik di gudang sebelum didaftarkan (mis. mendigitalisasi stok lama). Kosongkan/0 kalau stok akan ditambah lewat Barang Masuk seperti biasa.'}
            </p>
          </div>
          <NumberField
            label="Stok Minimum"
            value={form.minStock ?? 0}
            onValueChange={(value) => setForm({ ...form, minStock: value })}
          />
        </div>
        <SelectWithCreate
          label="Satuan"
          value={form.unitId ?? ''}
          onChange={(value) => setForm({ ...form, unitId: value })}
          placeholder="Pilih satuan"
          options={(satuanList ?? []).map((s) => ({ label: `${s.nama} (${s.singkatan})`, value: String(s.id) }))}
          createLabel="+ Tambah Satuan Baru"
          secondaryFieldLabel="Singkatan"
          onCreate={async (nama, singkatan) => {
            const ok = await confirm({
              title: 'Tambah Satuan Baru',
              message: `Tambahkan satuan baru "${nama}"? Apakah kamu yakin untuk melanjutkan?`,
              confirmLabel: 'Ya, Tambahkan',
              variant: 'default',
            });
            if (!ok) throw new Error('Dibatalkan.');
            const created = await satuanApi.create(nama, singkatan ?? nama.slice(0, 3));
            await mutateSatuan();
            return { label: `${created.nama} (${created.singkatan})`, value: String(created.id) };
          }}
        />
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
            value={beratKgText}
            onChange={(event) => {
              const typed = event.target.value;

              setBeratKgText(typed);

              const normalized = typed.replace(',', '.').trim();
              if (normalized === '' || normalized === '.' || normalized === '-') {
                setForm({ ...form, weightGram: undefined });
                handleBeratChangeForSku(undefined);
                return;
              }
              const kg = Number(normalized);
              if (Number.isNaN(kg)) {

                return;
              }
              const grams = Math.round(kg * 1000);
              setForm({ ...form, weightGram: grams });
              handleBeratChangeForSku(grams);
            }}
          />
          <p className="mt-1 text-xs text-textMuted">
            Contoh: 0.06 untuk 60 gram, 1.5 untuk 1,5 kg. Dipakai menampilkan berat di resi pengiriman,
            dan menentukan komponen Ukuran (S/M/L) di SKU otomatis — S di bawah 1kg, M 1-5kg, L di atas 5kg.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Merek (opsional)"
            value={form.merek ?? ''}
            onChange={(event) => handleMerekChangeForSku(event.target.value)}
            placeholder="mis. Huawei"
          />
          <Input
            label="Tipe (opsional)"
            value={form.tipe ?? ''}
            onChange={(event) => handleTipeChangeForSku(event.target.value)}
            placeholder="mis. HG8245H5, ONT"
          />
        </div>
        <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <input
            id="serialized-item"
            type="checkbox"
            className="mt-0.5"
            checked={form.isSerialized ?? false}
            onChange={(event) => setForm({ ...form, isSerialized: event.target.checked })}
          />
          <span>
            <label htmlFor="serialized-item" className="cursor-pointer font-medium text-text">
              Catat per Unit Fisik (Nomor Seri)
            </label>
            <p className="text-xs text-textMuted">
              Ini catatan identitas per unit di database — BUKAN pelacakan lokasi real-time
              (tidak butuh alat scan RFID/GPS apa pun untuk berfungsi). Aktifkan kalau unit fisik
              barang ini perlu dibedakan satu sama lain (mis. ONT/modem dengan SN/MAC address
              masing-masing, supaya bisa tahu unit MANA yang terpasang di pelanggan MANA).
              Barang Masuk/Keluar untuk barang ini nanti wajib mengisi SN per unit — bisa diketik
              manual, atau di-scan pakai kamera HP/laptop supaya lebih cepat (opsional, cuma
              mempercepat pengetikan).
            </p>
          </span>
        </div>
        <Input
          label="Deskripsi"
          value={form.deskripsi ?? ''}
          onChange={(event) => setForm({ ...form, deskripsi: event.target.value })}
        />
      </Modal>
      <Modal
        isOpen={delegatingRow !== null}
        title={`Delegasikan Pengajuan — ${delegatingRow?.name ?? ''}`}
        onClose={() => setDelegatingRow(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelegatingRow(null)}>
              Batal
            </Button>
            <Button onClick={handleDelegate} loading={isDelegating}>
              Delegasikan
            </Button>
          </>
        }
      >
        <p className="text-xs text-textMuted">
          Tugaskan admin tertentu untuk mengecek fisik (kondisi barang, kecocokan serial number & kode
          barang) dan memproses (Setujui/Tolak) pengajuan ini — kamu (super admin) tetap bisa
          memprosesnya sendiri kapan saja.
        </p>
        <Select
          label="Delegasikan ke Admin"
          value={delegateUserId}
          onChange={(e) => setDelegateUserId(e.target.value)}
          placeholder="Pilih admin"
          options={adminOptions}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}