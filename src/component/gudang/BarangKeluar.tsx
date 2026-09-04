'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Trash2, CheckCircle2, XCircle, Plus, X, Eye, Lock, Unlock } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select, NumberField } from '@/component/ui/FormControls';
import { ScanSnButton } from '@/component/ui/ScanSnButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { goodsOutApi, itemsApi, kategoriApi, satuanApi, warehousesApi, barangSerialApi, type KategoriRaw } from '@/lib/api/modules';
import { QuickAddItemModal } from '@/component/gudang/QuickAddItemModal';
import { HttpError } from '@/lib/api/client';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import type { RawBarangKeluar, RawBarangKeluarItem } from '@/lib/api/raw-types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

interface ItemRow {
  key: string;
  barangId: string;
  qty: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

const EMPTY_ITEM_ROW: Omit<ItemRow, 'key'> = { barangId: '', qty: 1 };

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

interface SpesifikasiEditorProps {
  item: RawBarangKeluarItem;
  onSave: (payload: { jumlahTerpasang: number; catatan: string }) => Promise<void>;
}

function SpesifikasiEditor({ item, onSave }: SpesifikasiEditorProps): React.JSX.Element {
  const [jumlahTerpasang, setJumlahTerpasang] = useState(item.jumlahTerpasang ?? 0);
  const [catatan, setCatatan] = useState(item.catatanSpesifikasi ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const sisa = Math.max(item.qty - jumlahTerpasang, 0);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    try {
      await onSave({ jumlahTerpasang, catatan });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded bg-neutralBg/50 p-2">
      <span className="text-[11px] font-semibold text-textMuted">
        Spesifikasi Pemasangan (mis. kabel: terpakai / terpasang / sisa)
      </span>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-textMuted">Terpakai</span>
          <span className="text-sm font-semibold text-text">{item.qty}</span>
        </div>
        <NumberField
          label="Terpasang"
          value={jumlahTerpasang}
          onValueChange={(value) => setJumlahTerpasang(Math.min(Math.max(value, 0), item.qty))}
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
      <Button variant="secondary" onClick={handleSave} loading={isSaving} className="self-start">
        Simpan Spesifikasi
      </Button>
    </div>
  );
}

export function BarangKeluarContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const { can } = usePermissions();
  const canEditBK = isStaff || can('barang_keluar', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [kategoriId, setKategoriId] = useState('');
  const [filterBarangId, setFilterBarangId] = useState('');
  const [filterMerek, setFilterMerek] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const { data: kategoriList } = useSWR<KategoriRaw[]>('kategori-list', () => kategoriApi.list());
  const { data: satuanList } = useSWR('satuan-list', () => satuanApi.list());
  const { data: barangList, mutate: mutateBarangList } = useSWR('items-for-goods-out', () => itemsApi.list({ pageSize: 200 }));
  const { data: gudangList } = useSWR('warehouses-for-goods-out', () => warehousesApi.list({ pageSize: 100 }));

  const merekOptions = Array.from(new Set((barangList?.data ?? []).map((b) => b.merek).filter(Boolean))) as string[];
  const tipeOptions = Array.from(new Set((barangList?.data ?? []).map((b) => b.tipe).filter(Boolean))) as string[];

  const [quickAddForRowIndex, setQuickAddForRowIndex] = useState<number | null>(null);

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, mutate, serverPagination } = useServerPaginatedList('goods-out', goodsOutApi, {
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
  const [keperluan, setKeperluan] = useState('');
  const [penerima, setPenerima] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [completingDoc, setCompletingDoc] = useState<RawBarangKeluar | null>(null);
  const [serialsByItemId, setSerialsByItemId] = useState<Record<string, string[]>>({});
  const [availableSerialsByBarangId, setAvailableSerialsByBarangId] = useState<Record<string, string[]>>({});
  const [isCompleting, setIsCompleting] = useState(false);

  const [detailDoc, setDetailDoc] = useState<RawBarangKeluar | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [snByItemId, setSnByItemId] = useState<Record<string, string[]>>({});

  async function openDetail(row: RawBarangKeluar): Promise<void> {
    setIsLoadingDetail(true);
    setDetailDoc(row);
    setSnByItemId({});
    try {
      const full = await goodsOutApi.getById(String(row.id));
      setDetailDoc(full);
      const serializedItems = (full.items ?? []).filter((it) => it.barang?.isSerialized);
      if (serializedItems.length > 0) {
        const results = await Promise.all(
          serializedItems.map((it) => barangSerialApi.list({ barangKeluarItemId: String(it.id), pageSize: 500 })),
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
    setKeperluan('');
    setPenerima('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
    // Lihat komentar yang sama di BarangMasuk.tsx: daftar barang cuma
    // di-fetch sekali saat mount, jadi bisa masih kosong/gagal diam-diam
    // di koneksi lambat (HP) saat modal ini dibuka. Paksa muat ulang.
    void mutateBarangList();
  }

  function openEditModal(row: RawBarangKeluar): void {
    if (row.status !== 'draft') {
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
    setKeperluan(row.keperluan ?? '');
    setPenerima(row.penerima ?? '');
    const rowsFromDoc = (row.items ?? []).map((it) => ({
      key: nextRowKey(),
      barangId: String(it.barangId),
      qty: it.qty ?? 1,
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
    if (!gudangId || !tanggal || !keperluan) {
      toast.error('Gudang, tanggal, dan keperluan wajib diisi.');
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
        keperluan,
        penerima,
        items: items.map((r) => ({
          barang_id: Number(r.barangId),
          qty: r.qty,
        })),
      };
      if (editingId) {
        await goodsOutApi.update(editingId, payload);
        toast.success('Dokumen barang keluar berhasil diubah.');
      } else {
        await goodsOutApi.create(payload);
        toast.success('Dokumen barang keluar berhasil dibuat (status: draft).');
      }
      setIsModalOpen(false);
      setEditingId(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, editingId ? 'Gagal mengubah dokumen barang keluar.' : 'Gagal membuat dokumen barang keluar.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(row: RawBarangKeluar): Promise<void> {
    if (row.status !== 'draft') {
      toast.error('Hanya dokumen berstatus draft yang bisa dihapus.');
      return;
    }
    if (row.isProtected) {
      toast.error('Dokumen ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Dokumen',
      message: `Apakah yakin ingin menghapus data ini? (${row.nomorPengeluaran})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await goodsOutApi.remove(String(row.id));
      toast.success('Dokumen berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus dokumen.'));
    }
  }

  async function handleComplete(row: RawBarangKeluar): Promise<void> {

    let full: RawBarangKeluar;
    try {
      full = await goodsOutApi.getById(String(row.id));
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengambil detail dokumen.'));
      return;
    }
    const itemsButuhSN = (full.items ?? []).filter((it) => it.barang?.isSerialized);
    if (itemsButuhSN.length === 0) {
      const ok = await confirm({
        title: 'Selesaikan Dokumen',
        message: `Selesaikan dokumen ${row.nomorPengeluaran}? Stok akan diperbarui otomatis.`,
        confirmLabel: 'Ya, Selesaikan',
        variant: 'default',
      });
      if (!ok) return;
      try {
        await goodsOutApi.complete(String(row.id));
        toast.success('Dokumen diselesaikan, stok telah diperbarui.');
        await mutate();
      } catch (err) {
        toast.error(friendlyError(err, 'Gagal menyelesaikan dokumen.'));
      }
      return;
    }

    const uniqueBarangIds = Array.from(new Set(itemsButuhSN.map((it) => String(it.barangId))));
    const availableMap: Record<string, string[]> = {};
    try {
      await Promise.all(
        uniqueBarangIds.map(async (barangId) => {
          const result = await barangSerialApi.list({
            barangId,
            gudangId: String(full.gudangId),
            status: 'tersedia',
            pageSize: 200,
            // FIFO: unit yang tercatat masuk paling lama muncul duluan, supaya
            // yang disarankan/terisi otomatis di bawah adalah stok lama dulu.
            urutan: 'fifo',
          });
          availableMap[barangId] = result.data.map((u) => u.serialNumber);
        }),
      );
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengambil daftar unit SN tersedia.'));
      return;
    }
    setAvailableSerialsByBarangId(availableMap);

    // Isi otomatis nomor seri dengan urutan FIFO (unit paling lama tercatat
    // duluan) supaya staf tidak perlu pilih manual satu-satu — tetap bisa
    // diganti kalau memang perlu unit tertentu.
    const consumedByBarangId: Record<string, number> = {};
    const initial: Record<string, string[]> = {};
    itemsButuhSN.forEach((it) => {
      const barangId = String(it.barangId);
      const pool = availableMap[barangId] ?? [];
      const startIdx = consumedByBarangId[barangId] ?? 0;
      const suggested = pool.slice(startIdx, startIdx + it.qty);
      consumedByBarangId[barangId] = startIdx + it.qty;
      initial[String(it.id)] = Array.from({ length: it.qty }, (_, i) => suggested[i] ?? '');
    });
    setSerialsByItemId(initial);
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
        toast.error(`Ada nomor seri yang dipilih berulang untuk "${it.barang?.nama ?? 'barang'}".`);
        return;
      }

      for (const sn of list) {
        if (allSerialsSeen.has(sn)) {
          toast.error(`Nomor seri "${sn}" dipilih lebih dari sekali di dokumen ini.`);
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
      await goodsOutApi.complete(String(completingDoc.id), trimmed);
      toast.success('Dokumen diselesaikan, stok & unit yang ber-SN telah diperbarui.');
      setCompletingDoc(null);
      setSerialsByItemId({});
      setAvailableSerialsByBarangId({});
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyelesaikan dokumen.'));
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleSaveSpesifikasi(
    itemId: number,
    payload: { jumlahTerpasang: number; catatan: string },
  ): Promise<void> {
    if (!detailDoc) return;
    try {
      const updated = await goodsOutApi.updateSpesifikasi(String(detailDoc.id), String(itemId), payload);
      toast.success('Spesifikasi pemasangan berhasil disimpan.');
      setDetailDoc((prev) =>
        prev ? { ...prev, items: (prev.items ?? []).map((x) => (x.id === updated.id ? updated : x)) } : prev,
      );
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan spesifikasi.'));
    }
  }

  async function handleCancel(row: RawBarangKeluar): Promise<void> {
    const ok = await confirm({
      title: 'Batalkan Dokumen',
      message: `Apakah yakin ingin membatalkan dokumen ${row.nomorPengeluaran}?`,
      confirmLabel: 'Ya, Batalkan',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await goodsOutApi.cancel(String(row.id));
      toast.success('Dokumen dibatalkan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membatalkan dokumen.'));
    }
  }

  const BK_EXPORT_COLUMNS = [
    { header: 'Tanggal', accessor: (r: RawBarangKeluar) => formatTanggalPanjang(r.tanggal) },
    { header: 'Nomor Pengeluaran', accessor: (r: RawBarangKeluar) => r.nomorPengeluaran },
    { header: 'Gudang', accessor: (r: RawBarangKeluar) => r.gudang?.nama ?? '-' },
    { header: 'Keperluan', accessor: (r: RawBarangKeluar) => r.keperluan },
    { header: 'Status', accessor: (r: RawBarangKeluar) => r.status },
  ];
  const BK_PDF_META = {
    title: 'Rekap Data Barang Keluar',
    subtitle: 'Pengelolaan / Barang Keluar',
    description: 'Riwayat dokumen pengeluaran barang dari gudang beserta keperluan dan status prosesnya (draft/selesai/dibatalkan).',
  };
  const BK_GRANULARITY: GranularityConfig<RawBarangKeluar> = {
    dateAccessor: (r) => r.tanggal,
    sumHeaders: [],
    groupKeyHeader: 'Gudang',
  };

  function handleExport(): void {
    requestExport(rows, BK_EXPORT_COLUMNS, 'daftar-barang-keluar', BK_PDF_META, BK_GRANULARITY);
  }

  async function handleBulkChange(selectedRows: RawBarangKeluar[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu dokumen draft yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU dokumen draft untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: RawBarangKeluar[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa dokumen draft yang mau dihapus.');
      return;
    }
    const nonDraft = selectedRows.filter((r) => r.status !== 'draft');
    if (nonDraft.length > 0) {
      toast.error('Hanya dokumen berstatus draft yang bisa dihapus — batalkan pilihan pada dokumen selesai/dibatalkan.');
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
      await Promise.all(selectedRows.map((r) => goodsOutApi.remove(String(r.id))));
      toast.success(`${selectedRows.length} dokumen berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua dokumen gagal dihapus.'));
    }
  }

  async function handleToggleProtect(row: RawBarangKeluar): Promise<void> {
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
      await goodsOutApi.setProtected(String(row.id), willProtect);
      toast.success(willProtect ? 'Dokumen dikunci (Protect).' : 'Dokumen dibuka kuncinya.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleBulkProtect(selectedRows: RawBarangKeluar[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih dokumen yang mau dikunci/dibuka.');
      return;
    }
    // Lihat komentar di handleBulkProtect BarangMasuk.tsx: kalau seleksinya
    // campuran (ada yang sudah dikunci, ada yang belum), jangan asal ikuti
    // status dokumen pertama — bisa-bisa dokumen yang sengaja dikunci malah
    // ikut terbuka kuncinya.
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
      await Promise.all(selectedRows.map((r) => goodsOutApi.setProtected(String(r.id), shouldProtect)));
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
        printRowsToPdf(rows, BK_EXPORT_COLUMNS, { ...BK_PDF_META, generatedBy: user?.fullName });
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

  const columns: DataTableColumn<RawBarangKeluar>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: RawBarangKeluar) => (
              <input
                type="checkbox"
                checked={selectedIds.has(String(row.id))}
                onChange={() => toggleSelected(String(row.id))}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<RawBarangKeluar>,
        ]
      : []),
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'code', header: 'Nomor Pengeluaran', render: (row) => row.nomorPengeluaran },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudang?.nama ?? '-' },
    { key: 'keperluan', header: 'Keperluan', render: (row) => row.keperluan },
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
          {row.status === 'draft' && canEditBK && !row.isProtected ? (
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
          {row.status === 'draft' && isStaff && !row.isProtected ? (
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
    <PageShell title="Barang Keluar" breadcrumb="Pengelolaan / Barang Keluar">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Transaksi', value: rows.length },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'selesai').length,
          },
          {
            id: 'proses',
            label: 'Diproses',
            value: rows.filter((r) => r.status === 'draft').length,
          },
        ]}
      />

      <DataTable
        title="Riwayat Barang Keluar"
        description="Catatan pengeluaran barang dari gudang"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="barang_keluar"

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
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nomor pengeluaran......" />
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        title="Tambah Barang Keluar"
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Simpan (Draft)
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gudang Asal"
            value={gudangId}
            onChange={(e) => handleGudangChange(e.target.value)}
            placeholder="Pilih gudang"
            options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
          <Input label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <Input label="Keperluan" value={keperluan} onChange={(e) => setKeperluan(e.target.value)} />
        <Input label="Penerima (opsional)" value={penerima} onChange={(e) => setPenerima(e.target.value)} />

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
                onChange={(e) => updateItemRow(index, { barangId: e.target.value })}
                placeholder={barangList === undefined ? 'Memuat daftar barang...' : 'Pilih barang'}
                disabled={barangList === undefined}
                options={(barangList?.data ?? []).map((b) => {
                  const details = [b.merek, b.tipe].filter(Boolean).join(' ');
                  const detailsText = details ? ` (${details})` : '';
                  return {
                    label: `${b.sku} — ${b.name}${detailsText}`,
                    value: b.id,
                  };
                })}
              />
              <button
                type="button"
                onClick={() => setQuickAddForRowIndex(index)}
                className="-mt-1 flex items-center gap-1 self-start text-xs font-semibold text-accentDark hover:underline"
              >
                <Plus className="h-3 w-3" /> Barang belum ada di daftar? Tambah baru
              </button>
              <NumberField
                label="Qty"
                value={row.qty}
                onValueChange={(value) => updateItemRow(index, { qty: value })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={completingDoc !== null}
        title={`Pilih Nomor Seri — ${completingDoc?.nomorPengeluaran ?? ''}`}
        onClose={() => {
          setCompletingDoc(null);
          setSerialsByItemId({});
          setAvailableSerialsByBarangId({});
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCompletingDoc(null);
                setSerialsByItemId({});
                setAvailableSerialsByBarangId({});
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
          {(completingDoc?.items ?? [])
            .filter((it) => it.barang?.isSerialized)
            .map((it) => {
              const options = availableSerialsByBarangId[String(it.barangId)] ?? [];
              const datalistId = `sn-options-${it.id}`;
              return (
                <div key={it.id} className="flex flex-col gap-2 rounded-md border border-borderSoft p-3">
                  <span className="text-sm font-medium text-text">
                    {it.barang?.nama ?? `Barang #${it.barangId}`}{' '}
                    <span className="text-xs font-normal text-textMuted">
                      ({it.qty} unit — {options.length} tersedia di gudang ini)
                    </span>
                  </span>
                  <span className="text-[11px] text-textMuted">
                    Nomor seri sudah disarankan otomatis berdasarkan urutan FIFO (unit paling lama tercatat keluar
                    duluan) — ganti manual kalau memang perlu unit tertentu.
                  </span>
                  <datalist id={datalistId}>
                    {options.map((sn) => (
                      <option key={sn} value={sn} />
                    ))}
                  </datalist>
                  {(serialsByItemId[String(it.id)] ?? []).map((sn, index) => (
                    <div key={`${it.id}-${sn}`} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          label={`Nomor Seri unit ke-${index + 1}`}
                          list={datalistId}
                          placeholder="Ketik/scan atau pilih dari saran"
                          value={sn}
                          onChange={(event) => updateSerialValue(String(it.id), index, event.target.value)}
                        />
                      </div>
                      <ScanSnButton onScan={(value) => updateSerialValue(String(it.id), index, value)} />
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </Modal>

      <Modal
        isOpen={detailDoc !== null}
        title={`Rincian Barang — ${detailDoc?.nomorPengeluaran ?? ''}`}
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
              <p className="text-sm text-textMuted">Dokumen ini belum punya data barang.</p>
            ) : (
              (detailDoc?.items ?? []).map((it: RawBarangKeluarItem) => (
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
                  </div>
                  {it.barang?.isSerialized ? (
                    <div className="mt-1 flex flex-col gap-1 rounded bg-neutralBg/50 p-2">
                      <span className="text-[11px] font-semibold text-textMuted">Nomor Seri (SN)</span>
                      {(snByItemId[String(it.id)] ?? []).length === 0 ? (
                        <span className="text-[11px] text-textMuted">
                          {detailDoc?.status === 'draft' ? 'Belum dipilih — selesaikan dokumen untuk mencatat SN.' : 'Tidak ada SN tercatat.'}
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
                  {detailDoc && detailDoc.status === 'selesai' ? (
                    <SpesifikasiEditor item={it} onSave={(payload) => handleSaveSpesifikasi(it.id, payload)} />
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
          updateItemRow(quickAddForRowIndex, { barangId: item.id });
          void mutateBarangList();
        }}
      />
    </PageShell>
  );
}