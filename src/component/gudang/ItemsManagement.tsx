'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock, CheckCircle2, XCircle, Tags, UserCog, Eye } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn, type ServerPaginationConfig } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { CurrencyField, Input, NumberField, Select, SelectWithCreate } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { itemsApi, kategoriApi, satuanApi, usersApi, warehousesApi, barangSerialApi, spesifikasiApi, goodsOutApi } from '@/lib/api/modules';
import type { RawBarangDetailStok, RawSpesifikasiListRow } from '@/lib/api/raw-types';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { printSkuLabels } from '@/lib/utils/print-sku-label';
import { ITEM_STATUS_META } from '@/lib/utils/status';
import { resolveEquipmentAbbreviation } from '@/lib/utils/equipment-abbreviations';
import type { Item, BarangSerialUnit, StatusBadgeVariant } from '@/types';
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
  warehouseId: '',
};

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';

function getDaftarTabDescription(isBulkMode: boolean, selectedCount: number, delegatedToMe: boolean): string {
  if (isBulkMode) {
    return `Mode Modify aktif ${selectedCount}. Silakan Pilih data per baris lalu gunakan Change/Delete/Protect di atas.`;
  }
  if (delegatedToMe) {
    return 'Barang yang didelegasikan (ditugaskan) super admin kepadamu untuk dicek fisik & diproses.';
  }
  return 'Seluruh SKU yang terdaftar di gudang';
}

// detailStokSerialsKey/fetchDetailStokSerials: dipisah dari body komponen
// (bukan cuma ditulis inline di argumen useSWR) supaya kompleksitas
// kognitif ItemsManagementContent tidak melebihi batas linter.
function detailStokSerialsKey(row: Item | null): [string, string] | null {
  return row?.isSerialized ? ['barang-detail-stok-serials', row.id] : null;
}

function fetchDetailStokSerials(row: Item | null) {
  if (!row) return null;
  return barangSerialApi.list({ barangId: row.id, pageSize: 200 });
}

interface KelolaBarangDaftarTabProps {
  columns: DataTableColumn<Item>[];
  rows: Item[];
  isLoading: boolean;
  errorMessage?: string;
  isBulkMode: boolean;
  selectedIds: Set<string>;
  onRowAction: (action: TableRowAction) => void | Promise<void>;
  onBulkPrintLabels: (rows: Item[]) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  serverPagination: ServerPaginationConfig;
  isAdminRole: boolean;
  delegatedToMe: boolean;
  onToggleDelegatedToMe: () => void;
  filterMerek: string;
  onFilterMerekChange: (value: string) => void;
  merekOptions: string[];
  filterTipe: string;
  onFilterTipeChange: (value: string) => void;
  tipeOptions: string[];
}

function KelolaBarangDaftarTab({
  columns,
  rows,
  isLoading,
  errorMessage,
  isBulkMode,
  selectedIds,
  onRowAction,
  onBulkPrintLabels,
  searchInput,
  onSearchInputChange,
  serverPagination,
  isAdminRole,
  delegatedToMe,
  onToggleDelegatedToMe,
  filterMerek,
  onFilterMerekChange,
  merekOptions,
  filterTipe,
  onFilterTipeChange,
  tipeOptions,
}: KelolaBarangDaftarTabProps): React.JSX.Element {
  const description = getDaftarTabDescription(isBulkMode, selectedIds.size, delegatedToMe);
  return (
    <DataTable
      title="Daftar Barang"
      description={description}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRowAction={onRowAction}
      module="kelola_barang"
      serverPagination={serverPagination}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {isBulkMode ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onBulkPrintLabels(rows.filter((r) => selectedIds.has(r.id)))}
              disabled={selectedIds.size === 0}
            >
              <Tags className="mr-1.5 h-3.5 w-3.5" /> Cetak Label Terpilih
            </Button>
          ) : null}
          {isAdminRole ? (
            <button
              type="button"
              onClick={onToggleDelegatedToMe}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                delegatedToMe
                  ? 'border-accentDark bg-accentDark text-white'
                  : 'border-borderSoft bg-surfaceAlt text-textMuted hover:text-text'
              }`}
            >
              Didelegasikan ke Saya
            </button>
          ) : null}
          <Select
            value={filterMerek}
            onChange={(e) => onFilterMerekChange(e.target.value)}
            placeholder="Semua Merek"
            options={merekOptions.map((m) => ({ label: m, value: m }))}
            className="w-40"
          />
          <Select
            value={filterTipe}
            onChange={(e) => onFilterTipeChange(e.target.value)}
            placeholder="Semua Tipe"
            options={tipeOptions.map((t) => ({ label: t, value: t }))}
            className="w-40"
          />
          <TableSearchInput value={searchInput} onChange={onSearchInputChange} placeholder="Cari SKU/nama barang......" />
        </div>
      }
    />
  );
}

interface HargaBeliFieldProps {
  isEditing: boolean;
  stock: number;
  price: number;
  onPriceChange: (value: number) => void;
}

// Harga Beli SENGAJA tidak lagi jadi field yang selalu tampil di form
// Tambah/Ubah Barang (dulu selalu ada, sekarang dipindah fokusnya) — nilai
// barang normalnya sudah otomatis dihitung sistem (rata-rata tertimbang)
// dari harga satuan di setiap dokumen Barang Masuk saat stok diterima,
// jadi tidak perlu diisi manual tiap kali. Field manual cuma muncul untuk
// kasus SATU-satunya yang memang butuh: mendaftarkan barang yang stok
// fisiknya sudah ada duluan (Stok Awal > 0) sebelum sempat lewat Barang
// Masuk, supaya nilai stok itu tidak tercatat Rp 0 di laporan. Untuk
// penilaian aset per unit/per barang yang lebih detail (bukan cuma harga
// beli rata-rata), gunakan field "Nilai Aset" di menu Manajemen Aset Barang.
function HargaBeliField({ isEditing, stock, price, onPriceChange }: HargaBeliFieldProps): React.JSX.Element | null {
  if (!isEditing && stock > 0) {
    return (
      <div>
        <CurrencyField label="Harga Beli Awal (untuk Stok Awal)" value={price} onValueChange={onPriceChange} />
        <p className="mt-1 text-xs text-textMuted">
          Dipakai sebagai dasar nilai stok awal yang diisi di atas. Untuk stok berikutnya, harga
          rata-rata akan diperbarui otomatis dari dokumen Barang Masuk.
        </p>
      </div>
    );
  }
  if (isEditing) {
    return (
      <div>
        <p className="text-sm font-medium text-text">Harga Beli (rata-rata tertimbang)</p>
        <p className="mt-1.5 rounded-md border border-borderSoft bg-neutralBg px-4 py-2.5 text-sm text-text">
          {formatCurrency(price)}
        </p>
        <p className="mt-1 text-xs text-textMuted">
          Diperbarui otomatis oleh sistem dari harga satuan di setiap dokumen Barang Masuk — tidak
          diedit manual dari sini supaya perhitungan nilai stok tetap akurat.
        </p>
      </div>
    );
  }
  return null;
}

export function ItemsManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canEditItem = isStaff || can('kelola_barang', 'edit');
  const canEditSpesifikasi = isStaff || can('barang_keluar', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const isAdminRole = user?.role === 'admin';
  const [delegatedToMe, setDelegatedToMe] = useState(false);

  const [filterMerek, setFilterMerek] = useState('');
  const [filterTipe, setFilterTipe] = useState('');

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, error, mutate, serverPagination } = useServerPaginatedList(
    'items',
    itemsApi,
    {
      search: searchTerm || undefined,
      delegated_to_me: delegatedToMe ? 'true' : undefined,
      merek: filterMerek || undefined,
      tipe: filterTipe || undefined,
    },
  );
  const { data: kategoriList, mutate: mutateKategori } = useSWR('kategori-list', () => kategoriApi.list());
  const { data: satuanList, mutate: mutateSatuan } = useSWR('satuan-list', () => satuanApi.list());
  const { data: gudangList } = useSWR('warehouses-for-kelola-barang', () => warehousesApi.list({ pageSize: 100 }));
  // Daftar barang lengkap (bukan yang lagi terfilter/terpaginasi) cuma buat
  // membangun opsi dropdown Merek/Tipe yang mencerminkan seluruh data, bukan
  // cuma barang di halaman yang sedang tampil.
  const { data: allItemsForFilters } = useSWR('items-all-for-filters', () => itemsApi.list({ pageSize: 500 }));
  const merekOptions = Array.from(new Set((allItemsForFilters?.data ?? []).map((b) => b.merek).filter(Boolean))) as string[];
  const tipeOptions = Array.from(new Set((allItemsForFilters?.data ?? []).map((b) => b.tipe).filter(Boolean))) as string[];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Item>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  // originalStock: nilai stok saat modal Ubah Barang dibuka — dipakai untuk
  // mendeteksi apakah user benar-benar mengoreksi stok (supaya gudang
  // tujuan koreksi cuma wajib dipilih kalau stok memang diubah, real-time-safe).
  const [originalStock, setOriginalStock] = useState(0);

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

  async function handleBatalkanDelegasi(): Promise<void> {
    if (!delegatingRow) return;
    setIsDelegating(true);
    try {
      await itemsApi.batalkanDelegasi(delegatingRow.id);
      toast.success('Delegasi berhasil dibatalkan.');
      setDelegatingRow(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membatalkan delegasi.'));
    } finally {
      setIsDelegating(false);
    }
  }

  const [detailStokRow, setDetailStokRow] = useState<Item | null>(null);
  const { data: detailStok, isLoading: isLoadingDetailStok } = useSWR(
    detailStokRow ? ['barang-detail-stok', detailStokRow.id] : null,
    () => (detailStokRow ? itemsApi.detailStok(detailStokRow.id) : null),
  );
  // Cuma di-fetch untuk barang isSerialized — daftar nomor seri per unit,
  // ditampilkan sebagai tabel tambahan di modal Detail Stok.
  const { data: detailStokSerials, isLoading: isLoadingDetailStokSerials } = useSWR(
    detailStokSerialsKey(detailStokRow),
    () => fetchDetailStokSerials(detailStokRow),
  );

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
    setOriginalStock(0);
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
    setOriginalStock(row.stock);
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
      warehouseId: '',
    });
    setBeratKgText(
      row.weightGram !== undefined && row.weightGram !== null ? String(row.weightGram / 1000) : '',
    );
    setIsModalOpen(true);
  }

  function getFormValidationError(): string | null {
    if (!form.categoryId || !form.unitId) {
      return 'Kategori dan Satuan wajib dipilih.';
    }
    if (!form.sku?.trim()) {
      return 'SKU wajib diisi — pilih kategori dulu untuk saran otomatis, atau isi manual.';
    }
    if (isGeneratingSku) {
      return 'Tunggu saran SKU selesai dibuat sebentar lagi.';
    }
    if (skuMode === 'manual' && skuAvailability === 'taken') {
      return 'SKU ini sudah dipakai barang lain — ganti dulu sebelum menyimpan.';
    }
    if (!editingId && (form.stock ?? 0) > 0 && !form.warehouseId) {
      return 'Stok awal diisi tapi gudang tujuannya belum dipilih — pilih gudang supaya stok ini tercatat di lokasi yang benar.';
    }
    if (editingId && (form.stock ?? 0) !== originalStock && !form.warehouseId) {
      return 'Stok dikoreksi tapi gudang tujuan koreksinya belum dipilih — pilih gudang yang stoknya mau dikoreksi supaya tetap tercatat real-time per gudang.';
    }
    return null;
  }

  async function handleSave(): Promise<void> {
    const validationError = getFormValidationError();
    if (validationError) {
      toast.error(validationError);
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
    { header: 'Status', accessor: (r: Item) => r.status },
    { header: 'Tanggal Dibuat', accessor: (r: Item) => formatTanggalPanjang(r.createdAt) },
  ];
  const ITEM_PDF_META = {
    title: 'Rekap Data Kelola Barang',
    subtitle: 'Pengelolaan / Kelola Barang',
    description: 'Data keseluruhan di dalam berbagai gudang.',
  };
  const ITEM_GRANULARITY: GranularityConfig<Item> = {
    dateAccessor: (r) => r.createdAt,
    sumHeaders: ['Stok'],
    groupKeyHeader: 'SKU',
  };

  function handleExport(): void {
    requestExport(rows, ITEM_EXPORT_COLUMNS, 'daftar-barang', ITEM_PDF_META, ITEM_GRANULARITY);
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
            onClick={() => setDetailStokRow(row)}
            title="Detail Stok Real-time (Masuk/Keluar)"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
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
      <KelolaBarangDaftarTab
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        isBulkMode={isBulkMode}
        selectedIds={selectedIds}
        onRowAction={handleRowAction}
        onBulkPrintLabels={handleBulkPrintLabels}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        serverPagination={serverPagination}
        isAdminRole={isAdminRole}
        delegatedToMe={delegatedToMe}
        onToggleDelegatedToMe={() => setDelegatedToMe((prev) => !prev)}
        filterMerek={filterMerek}
        onFilterMerekChange={setFilterMerek}
        merekOptions={merekOptions}
        filterTipe={filterTipe}
        onFilterTipeChange={setFilterTipe}
        tipeOptions={tipeOptions}
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
                800gr → &quot;TEK-ONT-HUA-S-0007&quot;). 
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
          <div>
            <NumberField
              label="Stok Minimum"
              value={form.minStock ?? 0}
              onValueChange={(value) => setForm({ ...form, minStock: value })}
            />
            <p className="mt-1 text-xs text-textMuted">
              Ambang batas peringatan &quot;Stok Menipis&quot; — status barang otomatis berubah kalau
              stok sekarang turun sampai atau di bawah angka ini.
            </p>
          </div>
        </div>
        <HargaBeliField
          isEditing={Boolean(editingId)}
          stock={form.stock ?? 0}
          price={form.price ?? 0}
          onPriceChange={(value) => setForm({ ...form, price: value })}
        />
        {!editingId ? (
          <div>
            <Select
              label="Gudang Tujuan Stok Awal"
              value={form.warehouseId ?? ''}
              onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
              placeholder="Pilih gudang"
              options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
            />
            <p className="mt-1 text-xs text-textMuted">
              {(form.stock ?? 0) > 0
                ? 'Wajib dipilih karena Stok Awal di atas diisi — stok ini akan langsung tercatat di gudang yang dipilih.'
                : 'Cuma perlu dipilih kalau Stok Awal di atas diisi. Kalau stok akan ditambah lewat Barang Masuk seperti biasa, boleh dikosongkan.'}
            </p>
          </div>
        ) : null}
        <StokKoreksiGudangField
          visible={Boolean(editingId) && (form.stock ?? 0) !== originalStock}
          originalStock={originalStock}
          currentStock={form.stock ?? 0}
          warehouseId={form.warehouseId ?? ''}
          onWarehouseIdChange={(value) => setForm({ ...form, warehouseId: value })}
          gudangOptions={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
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
      <DelegateModal
        row={delegatingRow}
        delegateUserId={delegateUserId}
        onDelegateUserIdChange={setDelegateUserId}
        adminOptions={adminOptions}
        isDelegating={isDelegating}
        onClose={() => setDelegatingRow(null)}
        onDelegate={handleDelegate}
        onBatalkanDelegasi={handleBatalkanDelegasi}
      />
      <DetailStokModal
        row={detailStokRow}
        data={detailStok}
        isLoading={isLoadingDetailStok}
        serials={detailStokSerials?.data}
        isLoadingSerials={isLoadingDetailStokSerials}
        canEditSpesifikasi={canEditSpesifikasi}
        onClose={() => setDetailStokRow(null)}
      />
      {exportDialog}
    </PageShell>
  );
}

interface StokKoreksiGudangFieldProps {
  visible: boolean;
  originalStock: number;
  currentStock: number;
  warehouseId: string;
  onWarehouseIdChange: (value: string) => void;
  gudangOptions: { label: string; value: string }[];
}

// StokKoreksiGudangField: cuma muncul saat "Ubah Barang" dan nilai Stok
// diubah dari nilai aslinya — memaksa pengguna memilih gudang tujuan
// koreksi supaya backend bisa menerapkan selisihnya ke barang_stok_gudang
// lalu menghitung ulang total stok secara real-time (bukan menimpa Stok
// langsung tanpa jejak gudang, yang menyebabkan bug drift sebelumnya).
function StokKoreksiGudangField({
  visible,
  originalStock,
  currentStock,
  warehouseId,
  onWarehouseIdChange,
  gudangOptions,
}: StokKoreksiGudangFieldProps): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <div>
      <Select
        label="Gudang Tujuan Koreksi Stok"
        value={warehouseId}
        onChange={(event) => onWarehouseIdChange(event.target.value)}
        placeholder="Pilih gudang"
        options={gudangOptions}
      />
      <p className="mt-1 text-xs text-textMuted">
        Wajib dipilih karena Stok di atas diubah dari {formatNumber(originalStock)} menjadi{' '}
        {formatNumber(currentStock)} — selisihnya akan diterapkan ke stok gudang ini, lalu total stok barang
        dihitung ulang otomatis (real-time) dari rincian per gudang.
      </p>
    </div>
  );
}

interface DelegateModalProps {
  row: Item | null;
  delegateUserId: string;
  onDelegateUserIdChange: (value: string) => void;
  adminOptions: { label: string; value: string }[];
  isDelegating: boolean;
  onClose: () => void;
  onDelegate: () => void | Promise<void>;
  onBatalkanDelegasi: () => void | Promise<void>;
}

function DelegateModal({
  row,
  delegateUserId,
  onDelegateUserIdChange,
  adminOptions,
  isDelegating,
  onClose,
  onDelegate,
  onBatalkanDelegasi,
}: DelegateModalProps): React.JSX.Element {
  return (
    <Modal
      isOpen={row !== null}
      title={`Delegasikan Pengajuan — ${row?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {row?.delegatedToUserId ? (
            <Button variant="secondary" onClick={onBatalkanDelegasi} loading={isDelegating}>
              Batal Delegasi
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={onDelegate} loading={isDelegating}>
            Delegasikan
          </Button>
        </>
      }
    >
      <p className="text-xs text-textMuted">
        Tugaskan admin tertentu untuk mengecek fisik (kondisi barang, kecocokan serial number & kode barang) dan
        memproses (Setujui/Tolak) pengajuan ini — kamu (super admin) tetap bisa memprosesnya sendiri kapan saja.
      </p>
      <Select
        label="Delegasikan ke Admin"
        value={delegateUserId}
        onChange={(e) => onDelegateUserIdChange(e.target.value)}
        placeholder="Pilih admin"
        options={adminOptions}
      />
    </Modal>
  );
}

interface DetailStokModalProps {
  row: Item | null;
  data: RawBarangDetailStok | null | undefined;
  isLoading: boolean;
  serials: BarangSerialUnit[] | undefined;
  isLoadingSerials: boolean;
  canEditSpesifikasi: boolean;
  onClose: () => void;
}

function DetailStokModal({ row, data, isLoading, serials, isLoadingSerials, canEditSpesifikasi, onClose }: DetailStokModalProps): React.JSX.Element {
  return (
    <Modal
      isOpen={row !== null}
      title={`Detail Stok Real-time — ${row?.name ?? ''}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {isLoading || !data ? (
        <p className="text-xs text-textMuted">Memuat data stok real-time...</p>
      ) : (
        <DetailStokModalBody
          data={data}
          isSerialized={row?.isSerialized ?? false}
          satuan={row?.unit}
          serials={serials}
          isLoadingSerials={isLoadingSerials}
          canEditSpesifikasi={canEditSpesifikasi}
        />
      )}
    </Modal>
  );
}

function DetailStokSerialTableBody({ serials }: { serials: BarangSerialUnit[] }): React.JSX.Element {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-borderSubtle text-left text-textMuted">
          <th className="py-1 font-medium">Nomor Seri</th>
          <th className="py-1 font-medium">Gudang</th>
          <th className="py-1 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {serials.map((unit) => (
          <tr key={unit.id} className="border-b border-borderSubtle last:border-0">
            <td className="py-1 font-mono text-textPrimary">{unit.serialNumber}</td>
            <td className="py-1 text-textPrimary">{unit.warehouseName ?? '-'}</td>
            <td className="py-1 text-right text-textPrimary">{unit.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailStokSerialTable({ isSerialized, serials, isLoadingSerials }: { isSerialized: boolean; serials: BarangSerialUnit[] | undefined; isLoadingSerials: boolean }): React.JSX.Element | null {
  if (!isSerialized) return null;
  let body: React.JSX.Element;
  if (isLoadingSerials || !serials) {
    body = <p className="text-xs text-textMuted">Memuat nomor seri...</p>;
  } else if (serials.length === 0) {
    body = <p className="text-xs text-textMuted">Belum ada nomor seri terdaftar untuk barang ini.</p>;
  } else {
    body = <DetailStokSerialTableBody serials={serials} />;
  }
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-textMuted">Nomor Seri</p>
      {body}
    </div>
  );
}

// StokKlasifikasiTiles: pembeda real-time "Barang Baku" (masih tersegel di
// gudang, belum dibuka) vs "Barang Jadi" (sudah dibuka/dikeluarkan lewat
// dokumen Barang Keluar & sedang/​sudah dalam progres pemasangan) — dihitung
// langsung dari totalStok/totalKeluar yang sudah dimuat di RawBarangDetailStok,
// jadi berlaku untuk barang apa pun (bukan cuma kabel), bukan cuma barang
// isSerialized.
function StokKlasifikasiTiles({
  totalStok,
  totalKeluar,
  satuan,
}: {
  totalStok: number;
  totalKeluar: number;
  satuan?: string;
}): React.JSX.Element {
  const unit = satuan ?? '';
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-textMuted">Klasifikasi Real-time</p>
      <StatsRow
        stats={[
          {
            id: 'barang-baku',
            label: 'Barang Baku (Tersegel)',
            value: `${formatNumber(totalStok)} ${unit}`.trim(),
            helperText: 'Masih di gudang, segel/kemasan belum dibuka',
          },
          {
            id: 'barang-jadi',
            label: 'Barang Jadi (Sudah Dibuka)',
            value: `${formatNumber(totalKeluar)} ${unit}`.trim(),
            helperText: 'Sudah keluar & dalam progres pemasangan',
          },
        ]}
      />
    </div>
  );
}

function DetailStokModalBody({
  data,
  isSerialized,
  satuan,
  serials,
  isLoadingSerials,
  canEditSpesifikasi,
}: {
  data: RawBarangDetailStok;
  isSerialized: boolean;
  satuan?: string;
  serials: BarangSerialUnit[] | undefined;
  isLoadingSerials: boolean;
  canEditSpesifikasi: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-xs text-textMuted">
        Kode barang <span className="font-semibold text-textPrimary">{data.kodeBarang}</span> — dihitung langsung
        dari dokumen Barang Masuk & Barang Keluar yang sudah selesai, jadi selalu real-time (bukan angka cache).
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-borderSubtle bg-neutralBg p-3 text-center">
          <p className="text-[11px] text-textMuted">Total Stok</p>
          <p className="text-lg font-semibold text-textPrimary">{data.totalStok}</p>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-successBg p-3 text-center">
          <p className="text-[11px] text-textMuted">Total Masuk</p>
          <p className="text-lg font-semibold text-successText">{data.totalMasuk}</p>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-dangerBg p-3 text-center">
          <p className="text-[11px] text-textMuted">Total Keluar</p>
          <p className="text-lg font-semibold text-dangerText">{data.totalKeluar}</p>
        </div>
      </div>
      <StokKlasifikasiTiles totalStok={data.totalStok} totalKeluar={data.totalKeluar} satuan={satuan} />
      <div>
        <p className="mb-1 text-[11px] font-medium text-textMuted">Stok per Gudang</p>
        {data.perGudang.length === 0 ? (
          <p className="text-xs text-textMuted">Belum ada stok di gudang manapun.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle text-left text-textMuted">
                <th className="py-1 font-medium">Gudang</th>
                <th className="py-1 text-right font-medium">Stok</th>
              </tr>
            </thead>
            <tbody>
              {data.perGudang.map((row) => (
                <tr key={row.gudangId} className="border-b border-borderSubtle last:border-0">
                  <td className="py-1 text-textPrimary">{row.namaGudang}</td>
                  <td className="py-1 text-right text-textPrimary">{row.stok}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <DetailStokSerialTable isSerialized={isSerialized} serials={serials} isLoadingSerials={isLoadingSerials} />
      <SpesifikasiSection barangId={String(data.barangId)} canEdit={canEditSpesifikasi} />
    </div>
  );
}

// progressBadge/EditSpesifikasiModal/SpesifikasiSection: dulu tab
// "Spesifikasi" terpisah di menu Kelola Barang (daftar gabungan semua
// barang) — sekarang dipindah jadi bagian dari modal Detail Stok per
// barang (progres terpakai/terpasang/sisa khusus barang ini saja),
// supaya semua rincian 1 barang — masuk/keluar, stok per gudang, nomor
// seri, dan spesifikasi — terkumpul di satu tempat.
function progressBadge(row: RawSpesifikasiListRow): { label: string; variant: StatusBadgeVariant } {
  if (row.jumlahTerpasang <= 0) return { label: 'Belum Terpasang', variant: 'warning' };
  if (row.jumlahTerpasang >= row.qty) return { label: 'Selesai Terpasang', variant: 'success' };
  return { label: 'Sebagian Terpasang', variant: 'info' };
}

interface EditSpesifikasiModalProps {
  row: RawSpesifikasiListRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditSpesifikasiModal({ row, onClose, onSaved }: EditSpesifikasiModalProps): React.JSX.Element {
  const [jumlahTerpasang, setJumlahTerpasang] = useState(row?.jumlahTerpasang ?? 0);
  const [catatan, setCatatan] = useState(row?.catatanSpesifikasi ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Sinkron ulang form setiap kali baris target berganti (modal dibuka lagi
  // untuk baris lain) — dilakukan lewat key di parent, lihat pemanggilan.
  const sisa = row ? Math.max(row.qty - jumlahTerpasang, 0) : 0;

  async function handleSave(): Promise<void> {
    if (!row) return;
    setIsSaving(true);
    try {
      await goodsOutApi.updateSpesifikasi(String(row.barangKeluarId), String(row.itemId), {
        jumlahTerpasang,
        catatan,
      });
      toast.success('Spesifikasi berhasil diperbarui.');
      onSaved();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memperbarui spesifikasi.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={row !== null}
      title={`Ubah Spesifikasi — ${row?.namaBarang ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Simpan
          </Button>
        </>
      }
    >
      {row ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-textMuted">
            Dari dokumen <span className="font-medium text-text">{row.nomorPengeluaran}</span> ({formatDate(row.tanggal)})
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-textMuted">Terpakai</span>
              <span className="text-sm font-semibold text-text">{row.qty}</span>
            </div>
            <NumberField
              label="Terpasang"
              value={jumlahTerpasang}
              onValueChange={(value) => setJumlahTerpasang(Math.min(Math.max(value, 0), row.qty))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-textMuted">Sisa</span>
              <span className="text-sm font-semibold text-text">{sisa}</span>
            </div>
          </div>
          <Input
            label="Catatan (opsional)"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. terpasang di Blok A"
          />
        </div>
      ) : null}
    </Modal>
  );
}

function SpesifikasiSectionTable({
  rows,
  canEdit,
  onEditRow,
}: {
  rows: RawSpesifikasiListRow[];
  canEdit: boolean;
  onEditRow: (row: RawSpesifikasiListRow) => void;
}): React.JSX.Element {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-borderSubtle text-left text-textMuted">
          <th className="py-1 font-medium">Tanggal</th>
          <th className="py-1 font-medium">Nomor Pengeluaran</th>
          <th className="py-1 font-medium">Gudang</th>
          <th className="py-1 text-right font-medium">Terpakai</th>
          <th className="py-1 text-right font-medium">Terpasang</th>
          <th className="py-1 text-right font-medium">Sisa</th>
          <th className="py-1 font-medium">Status</th>
          {canEdit ? <th className="py-1" /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const meta = progressBadge(row);
          return (
            <tr key={row.itemId} className="border-b border-borderSubtle last:border-0">
              <td className="py-1 text-textPrimary">{formatDate(row.tanggal)}</td>
              <td className="py-1 text-textPrimary">{row.nomorPengeluaran}</td>
              <td className="py-1 text-textPrimary">{row.namaGudang ?? '-'}</td>
              <td className="py-1 text-right text-textPrimary">{`${row.qty} ${row.satuan ?? ''}`.trim()}</td>
              <td className="py-1 text-right text-textPrimary">{`${row.jumlahTerpasang} ${row.satuan ?? ''}`.trim()}</td>
              <td className="py-1 text-right text-textPrimary">{`${row.jumlahSisa} ${row.satuan ?? ''}`.trim()}</td>
              <td className="py-1">
                <Badge label={meta.label} variant={meta.variant} />
              </td>
              {canEdit ? (
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onEditRow(row)}
                    title="Ubah spesifikasi"
                    className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SpesifikasiSection({ barangId, canEdit }: { barangId: string; canEdit: boolean }): React.JSX.Element {
  const { data, isLoading, mutate } = useSWR(['barang-detail-spesifikasi', barangId], () =>
    spesifikasiApi.list({ barangId, pageSize: 100 }),
  );
  const [editingRow, setEditingRow] = useState<RawSpesifikasiListRow | null>(null);
  const rows = data?.data ?? [];
  const belum = rows.filter((r) => r.jumlahTerpasang <= 0).length;
  const selesai = rows.filter((r) => r.jumlahTerpasang >= r.qty).length;
  const sebagian = rows.length - belum - selesai;
  // Ringkasan total Barang Jadi (kuantitas, bukan jumlah dokumen) — agregat
  // dari seluruh baris spesifikasi barang ini, dipakai sebagai rincian
  // lanjutan dari tile "Barang Jadi (Sudah Dibuka)" di atas modal.
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalTerpasang = rows.reduce((sum, r) => sum + r.jumlahTerpasang, 0);
  const totalSisa = rows.reduce((sum, r) => sum + r.jumlahSisa, 0);
  const satuanRingkasan = rows[0]?.satuan ?? '';

  let body: React.JSX.Element;
  if (isLoading) {
    body = <p className="text-xs text-textMuted">Memuat data spesifikasi...</p>;
  } else if (rows.length === 0) {
    body = <p className="text-xs text-textMuted">Belum ada progres spesifikasi (terpasang) untuk barang ini.</p>;
  } else {
    body = (
      <>
        <StatsRow
          stats={[
            { id: 'belum', label: 'Belum Terpasang', value: belum },
            { id: 'sebagian', label: 'Sebagian Terpasang', value: sebagian },
            { id: 'selesai', label: 'Selesai Terpasang', value: selesai },
          ]}
        />
        <p className="my-2 text-xs text-textMuted">
          Rincian Barang Jadi — Terpasang:{' '}
          <span className="font-semibold text-textPrimary">
            {formatNumber(totalTerpasang)} {satuanRingkasan}
          </span>{' '}
          · Sisa:{' '}
          <span className="font-semibold text-textPrimary">
            {formatNumber(totalSisa)} {satuanRingkasan}
          </span>{' '}
          · Total:{' '}
          <span className="font-semibold text-textPrimary">
            {formatNumber(totalQty)} {satuanRingkasan}
          </span>
        </p>
        <SpesifikasiSectionTable rows={rows} canEdit={canEdit} onEditRow={setEditingRow} />
      </>
    );
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-textMuted">
        Spesifikasi (Terpasang/Terpakai/Sisa) — khusus barang yang dipasang bertahap seperti kabel, tapi berlaku
        untuk barang apa pun yang punya progres pemasangan dari dokumen Barang Keluar.
      </p>
      {body}
      <EditSpesifikasiModal
        key={editingRow?.itemId ?? 'none'}
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaved={() => {
          setEditingRow(null);
          void mutate();
        }}
      />
    </div>
  );
}