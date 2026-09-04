'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Trash2, Pencil, CheckCircle2, XCircle, Plus, X, Eye, Lock, Unlock } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select, NumberField, CurrencyField } from '@/component/ui/FormControls';
import { ScanSnButton } from '@/component/ui/ScanSnButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { goodsInApi, itemsApi, kategoriApi, satuanApi, warehousesApi, barangSerialApi, type KategoriRaw } from '@/lib/api/modules';
import { QuickAddItemModal } from '@/component/gudang/QuickAddItemModal';
import { HttpError } from '@/lib/api/client';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import type { RawBarangMasuk, RawBarangMasukItem } from '@/lib/api/raw-types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

interface ItemRow {

  key: string;
  barangId: string;
  qty: number;
  hargaSatuan: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

const EMPTY_ITEM_ROW: Omit<ItemRow, 'key'> = { barangId: '', qty: 1, hargaSatuan: 0 };

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

export function BarangMasukContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const { can } = usePermissions();
  const canEditBM = isStaff || can('barang_masuk', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [kategoriId, setKategoriId] = useState('');
  const [filterBarangId, setFilterBarangId] = useState('');
  const [filterMerek, setFilterMerek] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const { data: kategoriList } = useSWR<KategoriRaw[]>('kategori-list', () => kategoriApi.list());
  const { data: satuanList } = useSWR('satuan-list', () => satuanApi.list());
  const { data: barangList, mutate: mutateBarangList } = useSWR('items-for-goods-in', () => itemsApi.list({ pageSize: 200 }));
  const { data: gudangList } = useSWR('warehouses-for-goods-in', () => warehousesApi.list({ pageSize: 100 }));

  const merekOptions = Array.from(new Set((barangList?.data ?? []).map((b) => b.merek).filter(Boolean))) as string[];
  const tipeOptions = Array.from(new Set((barangList?.data ?? []).map((b) => b.tipe).filter(Boolean))) as string[];

  const [quickAddForRowIndex, setQuickAddForRowIndex] = useState<number | null>(null);

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, mutate, serverPagination } = useServerPaginatedList('goods-in', goodsInApi, {
    kategori_id: kategoriId || undefined,
    barang_id: filterBarangId || undefined,
    merek: filterMerek || undefined,
    tipe: filterTipe || undefined,
    search: searchTerm || undefined,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [completingDoc, setCompletingDoc] = useState<RawBarangMasuk | null>(null);
  const [serialsByItemId, setSerialsByItemId] = useState<Record<string, string[]>>({});
  const [serialKeysByItemId, setSerialKeysByItemId] = useState<Record<string, string[]>>({});
  const [isCompleting, setIsCompleting] = useState(false);

  const [detailDoc, setDetailDoc] = useState<RawBarangMasuk | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [snByItemId, setSnByItemId] = useState<Record<string, string[]>>({});

  async function openDetail(row: RawBarangMasuk): Promise<void> {
    setIsLoadingDetail(true);
    setDetailDoc(row);
    setSnByItemId({});
    try {
      const full = await goodsInApi.getById(String(row.id));
      setDetailDoc(full);
      const serializedItems = (full.items ?? []).filter((it) => it.barang?.isSerialized);
      if (serializedItems.length > 0) {
        const results = await Promise.all(
          serializedItems.map((it) => barangSerialApi.list({ barangMasukItemId: String(it.id), pageSize: 500 })),
        );
        const next: Record<string, string[]> = {};
        serializedItems.forEach((it, index) => {
          next[String(it.id)] = results[index].data.map((u) => u.serialNumber);
        });
        setSnByItemId(next);
      }
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat rincian dokumen.'));
      setDetailDoc(null);
    } finally {
      setIsLoadingDetail(false);
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

  function handleGudangChange(nextGudangId: string): void {
    setGudangId(nextGudangId);
  }

  function openCreateModal(): void {
    setEditingId(null);
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
    // Daftar barang cuma di-fetch SEKALI saat komponen mount
    // ('items-for-goods-in'). Di koneksi lambat (terutama HP), fetch itu
    // bisa masih berjalan atau gagal diam-diam sebelum modal ini dibuka,
    // sehingga dropdown "Barang" kelihatan kosong padahal datanya ada.
    // Paksa muat ulang tiap kali modal dibuka supaya kejadian ini
    // sembuh sendiri tanpa user harus reload halaman.
    void mutateBarangList();
  }

  function openEditModal(row: RawBarangMasuk): void {
    if (row.status !== 'Draft') {
      toast.error('Hanya dokumen berstatus draft yang bisa diubah.');
      return;
    }
    if (row.isProtected) {
      toast.error('Dokumen ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(String(row.id));
    setGudangId(String(row.gudangId));
    setTanggal(row.tanggal ? row.tanggal.slice(0, 10) : '');
    setCatatan(row.catatan ?? '');
    const rowsFromDoc = (row.items ?? []).map((it) => ({
      key: nextRowKey(),
      barangId: String(it.barangId),
      qty: it.qty ?? 1,
      hargaSatuan: it.hargaSatuan ?? 0,
    }));
    setItemRows(rowsFromDoc.length > 0 ? rowsFromDoc : [{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
    void mutateBarangList();
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>): void {
    setItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeItemRow(index: number): void {
    setItemRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(): Promise<void> {
    if (!gudangId || !tanggal) {
      toast.error('Gudang dan tanggal wajib diisi.');
      return;
    }
    const items = itemRows.filter((r) => r.barangId && r.qty > 0);
    if (items.length === 0) {
      toast.error('Tambahkan minimal 1 baris barang dengan qty > 0.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        gudang_id: Number(gudangId),
        tanggal,
        catatan,
        items: items.map((r) => ({
          barang_id: Number(r.barangId),
          qty: r.qty,
          harga_satuan: r.hargaSatuan,
        })),
      };
      if (editingId) {
        await goodsInApi.update(editingId, payload);
        toast.success('Dokumen barang masuk berhasil diubah.');
      } else {
        await goodsInApi.create(payload);
        toast.success('Dokumen barang masuk berhasil dibuat (status: draft).');
      }
      setIsModalOpen(false);
      setEditingId(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, editingId ? 'Gagal mengubah dokumen barang masuk.' : 'Gagal membuat dokumen barang masuk.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(row: RawBarangMasuk): Promise<void> {
    if (row.status !== 'Draft') {
      toast.error('Hanya dokumen berstatus draft yang bisa dihapus.');
      return;
    }
    if (row.isProtected) {
      toast.error('Dokumen ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Dokumen',
      message: `Apakah yakin ingin menghapus data ini? (${row.nomorPenerimaan})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await goodsInApi.remove(String(row.id));
      toast.success('Dokumen berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus dokumen.'));
    }
  }

  async function handleComplete(row: RawBarangMasuk): Promise<void> {

    let full: RawBarangMasuk;
    try {
      full = await goodsInApi.getById(String(row.id));
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengambil detail dokumen.'));
      return;
    }
    const itemsButuhSN = (full.items ?? []).filter((it) => it.barang?.isSerialized);
    if (itemsButuhSN.length === 0) {

      const ok = await confirm({
        title: 'Selesaikan Dokumen',
        message: `Selesaikan dokumen ${row.nomorPenerimaan}? Stok akan diperbarui otomatis.`,
        confirmLabel: 'Ya, Selesaikan',
        variant: 'default',
      });
      if (!ok) return;
      try {
        await goodsInApi.complete(String(row.id));
        toast.success('Dokumen diselesaikan, stok telah diperbarui.');
        await mutate();
      } catch (err) {
        toast.error(friendlyError(err, 'Gagal menyelesaikan dokumen.'));
      }
      return;
    }

    const initial: Record<string, string[]> = {};
    const serialKeys: Record<string, string[]> = {};
    itemsButuhSN.forEach((it) => {
      initial[String(it.id)] = Array.from({ length: it.qty }, () => '');
      serialKeys[String(it.id)] = Array.from({ length: it.qty }, () => nextRowKey());
    });
    setSerialsByItemId(initial);
    setSerialKeysByItemId(serialKeys);
    setCompletingDoc(full);
  }

  function updateSerialValue(itemId: string, index: number, value: string): void {
    setSerialsByItemId((prev) => {
      const next = [...(prev[itemId] ?? [])];
      next[index] = value;
      return { ...prev, [itemId]: next };
    });
  }

  async function submitCompleteWithSerials(): Promise<void> {
    if (!completingDoc) return;
    const itemsButuhSN = (completingDoc.items ?? []).filter((it) => it.barang?.isSerialized);
    const allSerialsSeen = new Set<string>();
    for (const it of itemsButuhSN) {
      const list = (serialsByItemId[String(it.id)] ?? []).map((s) => s.trim());
      if (list.length !== it.qty || list.some((s) => !s)) {
      toast.error(`Pilih semua nomor seri untuk "${it.barang?.nama ?? 'barang'}" (${it.qty} unit).`);
      return;
      }
      if (new Set(list).size !== list.length) {
        toast.error(`Ada nomor seri yang diisi berulang untuk "${it.barang?.nama ?? 'barang'}".`);
        return;
      }

      for (const sn of list) {
        if (allSerialsSeen.has(sn)) {
          toast.error(`Nomor seri "${sn}" sudah digunakan. silakan cek kembali serial numbernya.`);
          return;
        }
        allSerialsSeen.add(sn);
      }
    }
    setIsCompleting(true);
    try {
      const trimmed: Record<string, string[]> = {};
      Object.entries(serialsByItemId).forEach(([itemId, list]) => {
        trimmed[itemId] = list.map((s) => s.trim());
      });
      await goodsInApi.complete(String(completingDoc.id), trimmed);
      toast.success('Dokumen diselesaikan, stok & unit SN telah diperbarui.');
      setCompletingDoc(null);
      setSerialsByItemId({});
      setSerialKeysByItemId({});
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyelesaikan dokumen.'));
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleCancel(row: RawBarangMasuk): Promise<void> {
    const ok = await confirm({
      title: 'Batalkan Dokumen',
      message: `Apakah yakin ingin membatalkan dokumen ${row.nomorPenerimaan}?`,
      confirmLabel: 'Ya, Batalkan',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await goodsInApi.cancel(String(row.id));
      toast.success('Dokumen dibatalkan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membatalkan dokumen.'));
    }
  }

  const BM_EXPORT_COLUMNS = [
    { header: 'Tanggal', accessor: (r: RawBarangMasuk) => formatTanggalPanjang(r.tanggal) },
    { header: 'Nomor Penerimaan', accessor: (r: RawBarangMasuk) => r.nomorPenerimaan },
    { header: 'Gudang', accessor: (r: RawBarangMasuk) => r.gudang?.nama ?? '-' },
    { header: 'Status', accessor: (r: RawBarangMasuk) => r.status },
  ];
  const BM_PDF_META = {
    title: 'Rekap Data Barang Masuk',
    subtitle: 'Pengelolaan Barang Masuk',
    description: 'Riwayat dokumen penerimaan barang masuk ke gudang beserta status prosesnya (draft/selesai/dibatalkan).',
  };

  const BM_GRANULARITY: GranularityConfig<RawBarangMasuk> = {
    dateAccessor: (r) => r.tanggal,
    sumHeaders: [],
    groupKeyHeader: 'Gudang',
  };

  function handleExport(): void {
    requestExport(rows, BM_EXPORT_COLUMNS, 'daftar-barang-masuk', BM_PDF_META, BM_GRANULARITY);
  }

  async function handleBulkChange(selectedRows: RawBarangMasuk[]): Promise<void> {
    if (!isBulkMode) {
      toast('Silakan Aktifkan "Modify" terlebih dahulu untuk memilih salah satu data yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih salah SATU dokumen draft untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: RawBarangMasuk[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" terlebih dahulu, lalu pilih salah satu atau beberapa dokumen draft yang mau dihapus.');
      return;
    }
    const nonDraft = selectedRows.filter((r) => r.status !== 'Draft');
    if (nonDraft.length > 0) {
      toast.error('Hanya data berstatus draft yang bisa dihapus. apabila sudah di proses selesai/dibatalkan maka tidak bisa dihapuskan .');
      return;
    }
    const protectedRows = selectedRows.filter((r) => r.isProtected);
    if (protectedRows.length > 0) {
      toast.error('Ada dokumen terpilih yang dikunci (Protect) oleh super admin — buka kuncinya dulu sebelum dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Dokumen Terpilih',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} dokumen draft terpilih?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => goodsInApi.remove(String(r.id))));
      toast.success(`${selectedRows.length} dokumen berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua dokumen gagal dihapus.'));
    }
  }

  async function handleToggleProtect(row: RawBarangMasuk): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Dokumen Ini?' : 'Buka Kunci Dokumen Ini?',
      message: willProtect
        ? 'Apakah Anda yakin untuk melindungi/mengunci dokumen ini supaya tidak bisa diubah atau dihapus oleh role karyawan?'
        : 'Apakah Anda yakin ingin membuka kunci dokumen ini?',
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await goodsInApi.setProtected(String(row.id), willProtect);
      toast.success(willProtect ? 'Dokumen dikunci (Protect).' : 'Dokumen dibuka kuncinya.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleBulkProtect(selectedRows: RawBarangMasuk[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih dokumen yang mau dikunci/dibuka.');
      return;
    }
    // Sebelumnya arah toggle (kunci vs buka) cuma dilihat dari status
    // dokumen PERTAMA yang dipilih lalu diterapkan mentah-mentah ke semua
    // dokumen terpilih — kalau pilihannya campuran (ada yang sudah dikunci,
    // ada yang belum), dokumen yang sudah dikunci sengaja bisa ikut
    // terbuka kuncinya tanpa operator benar-benar bermaksud membukanya.
    // Tolak dulu kalau campuran supaya arah aksinya selalu jelas.
    const isMixed = selectedRows.some((r) => r.isProtected) && selectedRows.some((r) => !r.isProtected);
    if (isMixed) {
      toast.error('Dokumen terpilih statusnya campuran (ada yang terkunci, ada yang belum) — pilih salah satu jenis saja supaya arah kunci/buka jelas.');
      return;
    }
    const shouldProtect = !selectedRows[0].isProtected;
    const ok = await confirm({
      title: shouldProtect ? 'Kunci Dokumen Terpilih?' : 'Buka Kunci Dokumen Terpilih?',
      message: shouldProtect
        ? 'Apakah Anda yakin untuk melindungi/mengunci dokumen terpilih supaya tidak bisa diubah atau dihapus oleh role karyawan?'
        : 'Apakah Anda yakin ingin membuka kunci dokumen terpilih?',
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => goodsInApi.setProtected(String(r.id), shouldProtect)));
      toast.success(shouldProtect ? 'Dokumen terpilih dikunci.' : 'Dokumen terpilih dibuka kuncinya.');
      setSelectedIds(new Set());
      await mutate();
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
        printRowsToPdf(rows, BM_EXPORT_COLUMNS, { ...BM_PDF_META, generatedBy: user?.fullName });
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

  const columns: DataTableColumn<RawBarangMasuk>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: RawBarangMasuk) => (
              <input
                type="checkbox"
                checked={selectedIds.has(String(row.id))}
                onChange={() => toggleSelected(String(row.id))}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<RawBarangMasuk>,
        ]
      : []),
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'code', header: 'Nomor Penerimaan', render: (row) => row.nomorPenerimaan },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudang?.nama ?? '-' },
    {
      key: 'items',
      header: 'Barang',
      render: (row) => {
        const names = (row.items ?? []).map((it) => it.barang?.nama).filter(Boolean) as string[];
        if (names.length === 0) return '-';
        return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} lainnya`;
      },
    },
    {
      key: 'kode-barang',
      header: 'Kode Barang',
      render: (row) => {
        const codes = (row.items ?? []).map((it) => it.barang?.kodeBarang).filter(Boolean) as string[];
        if (codes.length === 0) return '-';
        return codes.length === 1 ? codes[0] : `${codes[0]} +${codes.length - 1} lainnya`;
      },
    },
    {
      key: 'merek-tipe',
      header: 'Merek / Tipe',
      render: (row) => {
        const first = (row.items ?? []).find((it) => it.barang?.merek || it.barang?.tipe);
        if (!first) return '-';
        const label = [first.barang?.merek, first.barang?.tipe].filter(Boolean).join(' ');
        return (row.items ?? []).length > 1 ? `${label} +${(row.items?.length ?? 1) - 1} lainnya` : label || '-';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status] ?? { label: row.status, variant: 'neutral' as const };
        return (
          <div className="flex items-center gap-1.5">
            <Badge label={meta.label} variant={meta.variant} />
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
            onClick={() => openDetail(row)}
            title="Lihat rincian barang (Kode Barang, Merek, Tipe, SN)"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {row.status === 'Draft' && canEditBM && !row.isProtected ? (
            <>
              <button
                type="button"
                onClick={() => handleComplete(row)}
                title="Selesaikan"
                className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleCancel(row)}
                title="Batalkan"
                className="rounded p-1 text-textMuted hover:bg-warningBg hover:text-warningText"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {row.status === 'Draft' && canEditBM && !row.isProtected ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Ubah"
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.status === 'Draft' && isStaff && !row.isProtected ? (
            <button
              type="button"
              onClick={() => handleDelete(row)}
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
    <PageShell title="Barang Masuk" breadcrumb="Pengelolaan / Barang Masuk">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Transaksi', value: rows.length },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'Selesai').length,
          },
          {
            id: 'proses',
            label: 'Diproses',
            value: rows.filter((r) => r.status === 'Draft').length,
          },
        ]}
      />

      <DataTable
        title="Riwayat Barang Masuk"
        description={
          isBulkMode
            ? `Aktifkan Mode Modify ${selectedIds.size} dokumen terpilih. silakan Pilih per baris data kemudian bisa gunakan Change/Delete di atas.`
            : 'Catatan penerimaan barang ke gudang'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="barang_masuk"

        visibleActions={['add', 'change', 'delete', 'export', 'print', 'modify', 'protect']}
        serverPagination={serverPagination}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              placeholder="Semua Kategori"
              options={(kategoriList ?? []).map((k) => ({ label: k.nama, value: String(k.id) }))}
              className="w-44"
            />
            <Select
              value={filterBarangId}
              onChange={(e) => setFilterBarangId(e.target.value)}
              placeholder="Filter SKU"
              options={(barangList?.data ?? []).map((b) => ({ label: b.sku, value: b.id }))}
              className="w-44"
            />
            <Select
              value={filterBarangId}
              onChange={(e) => setFilterBarangId(e.target.value)}
              placeholder="Filter Nama Barang"
              options={(barangList?.data ?? []).map((b) => ({ label: b.name, value: b.id }))}
              className="w-52"
            />
            <Select
              value={filterMerek}
              onChange={(e) => setFilterMerek(e.target.value)}
              placeholder="Semua Merek"
              options={merekOptions.map((m) => ({ label: m, value: m }))}
              className="w-40"
            />
            <Select
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value)}
              placeholder="Semua Tipe"
              options={tipeOptions.map((t) => ({ label: t, value: t }))}
              className="w-40"
            />
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nomor penerimaan......" />
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Barang Masuk' : 'Tambah Barang Masuk'}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }}
            >
              Batal
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {editingId ? 'Simpan Perubahan' : 'Simpan (Draft)'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gudang Tujuan"
            value={gudangId}
            onChange={(e) => handleGudangChange(e.target.value)}
            placeholder="Pilih gudang"
            options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
          <Input label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <Input label="Catatan (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />

        <div className="flex flex-col gap-3 rounded-md border border-borderSoft p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">Daftar Barang</span>
            {editingId ? null : (
              <button
                type="button"
                onClick={() => setItemRows((prev) => [...prev, { ...EMPTY_ITEM_ROW, key: nextRowKey() }])}
                className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Baris
              </button>
            )}
          </div>
          {editingId ? (
            <p className="-mt-1 text-xs text-textMuted">
              Mode Ubah cuma untuk mengubah data barang yang sudah ada di dokumen ini (qty/harga). Untuk menambah
              barang baru, buat dokumen baru lewat tombol Add, atau lihat rincian dokumen lewat ikon mata.
            </p>
          ) : null}

          {itemRows.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-md border border-borderSoft bg-neutralBg/40 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-textMuted">Baris {index + 1}</span>
                {editingId ? null : (
                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={itemRows.length === 1}
                    className="flex items-center gap-1 text-xs font-medium text-dangerText hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X className="h-3 w-3" /> Hapus baris
                  </button>
                )}
              </div>
              <Select
                label="Barang"
                value={row.barangId}
                onChange={(e) => {
                  const barangId = e.target.value;

                  const selected = barangList?.data.find((b) => b.id === barangId);
                  updateItemRow(index, {
                    barangId,
                    hargaSatuan: row.hargaSatuan === 0 && selected ? selected.price : row.hargaSatuan,
                  });
                }}
                placeholder={barangList === undefined ? 'Memuat daftar barang...' : 'Pilih barang'}
                disabled={barangList === undefined}
                options={(barangList?.data ?? []).map((b) => ({
                  label: b.sku + ' — ' + b.name + (b.merek || b.tipe ? ' (' + [b.merek, b.tipe].filter(Boolean).join(' ') + ')' : ''),
                  value: b.id,
                }))}
              />
              <button
                type="button"
                onClick={() => setQuickAddForRowIndex(index)}
                className="-mt-1 flex items-center gap-1 self-start text-xs font-semibold text-accentDark hover:underline"
              >
                <Plus className="h-3 w-3" /> Barang belum ada di daftar? Tambah baru
              </button>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Qty"
                  value={row.qty}
                  onValueChange={(value) => updateItemRow(index, { qty: value })}
                />
                <CurrencyField
                  label="Harga Satuan"
                  value={row.hargaSatuan}
                  onValueChange={(value) => updateItemRow(index, { hargaSatuan: value })}
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={completingDoc !== null}
        title={`Isi Nomor Seri — ${completingDoc?.nomorPenerimaan ?? ''}`}
        onClose={() => {
          setCompletingDoc(null);
          setSerialsByItemId({});
          setSerialKeysByItemId({});
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCompletingDoc(null);
                setSerialsByItemId({});
                setSerialKeysByItemId({});
              }}
            >
              Batal
            </Button>
            <Button onClick={submitCompleteWithSerials} loading={isCompleting}>
              Selesaikan Dokumen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-textMuted">
            Dokumen ini berisi barang yang memiliki nomor seri (SN). Isi/scan SN fisik setiap
            unit sebelum stok & unit ditambahkan.
          </p>
          {(completingDoc?.items ?? [])
            .filter((it) => it.barang?.isSerialized)
            .map((it) => (
              <div key={it.id} className="flex flex-col gap-2 rounded-md border border-borderSoft p-3">
                <span className="text-sm font-medium text-text">
                  {it.barang?.nama ?? `Barang #${it.barangId}`}{' '}
                  <span className="text-xs font-normal text-textMuted">({it.qty} unit)</span>
                </span>
                {(serialsByItemId[String(it.id)] ?? []).map((sn, index) => (
                  <div key={serialKeysByItemId[String(it.id)]?.[index]} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label={`Nomor Seri unit ke-${index + 1}`}
                        value={sn}
                        onChange={(event) => updateSerialValue(String(it.id), index, event.target.value)}
                      />
                    </div>
                    <ScanSnButton onScan={(value) => updateSerialValue(String(it.id), index, value)} />
                  </div>
                ))}
              </div>
            ))}
        </div>
      </Modal>

      <Modal
        isOpen={detailDoc !== null}
        title={`Rincian Barang — ${detailDoc?.nomorPenerimaan ?? ''}`}
        onClose={() => {
          setDetailDoc(null);
          setSnByItemId({});
        }}
        footer={
          <Button variant="secondary" onClick={() => { setDetailDoc(null); setSnByItemId({}); }}>
            Tutup
          </Button>
        }
      >
        {isLoadingDetail ? (
          <p className="text-sm text-textMuted">Memuat rincian...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(detailDoc?.items ?? []).length === 0 ? (
              <p className="text-sm text-textMuted">Dokumen ini belum punya data barang yang tercatat.</p>
            ) : (
              (detailDoc?.items ?? []).map((it: RawBarangMasukItem) => (
                <div key={it.id} className="flex flex-col gap-1.5 rounded-md border border-borderSoft p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-text">
                      {it.barang?.nama ?? `Barang #${it.barangId}`}
                    </p>
                    <span className="shrink-0 text-xs text-textMuted">Qty: {it.qty}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-textMuted">
                    <span>Kode Barang: <span className="font-medium text-text">{it.barang?.kodeBarang ?? '-'}</span></span>
                    {it.barang?.merek ? <span>Merek: <span className="font-medium text-text">{it.barang.merek}</span></span> : null}
                    {it.barang?.tipe ? <span>Tipe: <span className="font-medium text-text">{it.barang.tipe}</span></span> : null}
                    <span>Harga Satuan: <span className="font-medium text-text">{formatCurrency(it.hargaSatuan)}</span></span>
                  </div>
                  {it.barang?.isSerialized ? (
                    <div className="mt-1 flex flex-col gap-1 rounded bg-neutralBg/50 p-2">
                      <span className="text-[11px] font-semibold text-textMuted">Nomor Seri (SN)</span>
                      {(snByItemId[String(it.id)] ?? []).length === 0 ? (
                        <span className="text-[11px] text-textMuted">
                          {detailDoc?.status === 'Draft' ? 'Belum diisi, silakan selesaikan dokumen untuk mencatat Serial Number Barang.' : 'Tidak ada Serial Number yang tercatat.'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(snByItemId[String(it.id)] ?? []).map((sn) => (
                            <span key={sn} className="rounded bg-white px-2 py-0.5 text-[11px] font-mono text-text ring-1 ring-borderSoft">
                              {sn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
      {exportDialog}

      <QuickAddItemModal
        isOpen={quickAddForRowIndex !== null}
        onClose={() => setQuickAddForRowIndex(null)}
        kategoriList={kategoriList}
        satuanList={satuanList}
        onCreated={(item) => {
          if (quickAddForRowIndex === null) return;
          updateItemRow(quickAddForRowIndex, {
            barangId: item.id,
            hargaSatuan: item.price,
          });
          void mutateBarangList();
        }}
      />
    </PageShell>
  );
}