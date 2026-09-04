'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Eye, Pencil, Plus, Trash2, Ban } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { inventoryApi, warehousesApi, itemsApi, type StockOpnamePayload } from '@/lib/api/modules';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatDate } from '@/lib/utils/format';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { RawStockOpname } from '@/lib/api/raw-types';

interface ItemRow {
  key: string;
  barangId: string;
  stokFisik: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `so-row-${rowKeyCounter}`;
}

function emptyRow(): ItemRow {
  return { key: nextRowKey(), barangId: '', stokFisik: 0 };
}

const SO_STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: 'Draft', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  dibatalkan: { label: 'Dibatalkan', variant: 'neutral' },
};

// Data stok sistem & fisik sudah ada per item — helper ini menghitung berapa
// SKU pada satu sesi yang hasilnya TIDAK sesuai (selisih !== 0), supaya bisa
// ditonjolkan di level daftar (bukan cuma terlihat di modal rincian).
function countSelisihItems(row: RawStockOpname): number {
  return (row.items ?? []).filter((it) => it.selisih !== 0).length;
}

function SelisihBadge({ count }: { count: number }): React.JSX.Element {
  if (count === 0) {
    return <Badge label="Sesuai" variant="success" />;
  }
  return <Badge label={`${count} Selisih`} variant="danger" />;
}

export function InventoryManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canCreateOpname = isStaff || can('stock_opname', 'tambah');
  const canCompleteOpname = isStaff || can('stock_opname', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, error, mutate, serverPagination } = useServerPaginatedList(
    'stock-opname-sessions',
    { list: inventoryApi.listSessions },
    { search: searchTerm || undefined },
    { initialLimit: 200 },
  );
  const { data: warehouseList } = useSWR('warehouses-for-opname', () => warehousesApi.list({ pageSize: 100 }));
  const { data: itemList } = useSWR('items-for-opname', () => itemsApi.list({ pageSize: 500 }));
  // mutateStokGudang WAJIB dipanggil manual setelah aksi yang benar-benar
  // mengubah stok (terutama Selesaikan) — SWR key ini terpisah dari
  // 'stock-opname-sessions' di atas, jadi mutate() untuk daftar sesi TIDAK
  // ikut menyegarkan cache ringkasan stok ini. Tanpa ini, kolom/figur "Stok
  // Sistem" (dipakai lewat liveStokSistem di bawah) bisa nyangkut di angka
  // lama sampai ada revalidasi SWR lain yang kebetulan terjadi (fokus tab,
  // dsb).
  const { data: stokGudangList, mutate: mutateStokGudang } = useSWR('stok-gudang-for-opname', () => inventoryApi.ringkasanStok());

  // Stok sistem yang benar itu PER GUDANG, bukan total global barang.
  // Peta ini dipakai supaya form langsung menampilkan angka yang sama dengan
  // yang akan dipakai sebagai "Stok Sistem" saat sesi dibuat/diselesaikan.
  const stokPerGudangMap = new Map<string, number>();
  (stokGudangList?.data ?? []).forEach((row) => {
    stokPerGudangMap.set(`${row.barangId}-${row.gudangId}`, row.quantity);
  });
  function liveStokSistem(barangId: string): number {
    if (!barangId || !gudangId) return 0;
    return stokPerGudangMap.get(`${barangId}-${gudangId}`) ?? 0;
  }

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);

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

  const sesiDenganSelisihCount = useMemo(
    () => rows.filter((r) => countSelisihItems(r) > 0).length,
    [rows],
  );

  const [detailFor, setDetailFor] = useState<RawStockOpname | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  async function openDetail(row: RawStockOpname): Promise<void> {
    setIsLoadingDetail(true);
    setDetailFor(row);
    try {
      const full = await inventoryApi.getById(String(row.id));
      setDetailFor(full);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat rincian sesi.'));
      setDetailFor(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function openCreateModal(): void {
    setEditingId(null);
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([emptyRow()]);
    setIsModalOpen(true);
  }

  function openEditModal(row: RawStockOpname): void {
    if (row.status !== 'draft') {
      toast.error('Hanya sesi berstatus draft yang bisa diubah.');
      return;
    }
    setEditingId(String(row.id));
    setGudangId(String(row.gudangId));
    setTanggal(row.tanggal ? row.tanggal.slice(0, 10) : '');
    setCatatan(row.catatan ?? '');

    // Sesi lama (dibuat sebelum barang yang sama tidak boleh dipilih dobel di
    // satu sesi) mungkin masih punya lebih dari satu baris untuk barang_id
    // yang sama. Gabungkan di sini secara EKSPLISIT (bukan diam-diam saat
    // Simpan) supaya operator tahu kenapa jumlah barisnya berubah.
    const mergedByBarangId = new Map<string, { key: string; barangId: string; stokFisik: number }>();
    const order: string[] = [];
    let duplicateCount = 0;
    (row.items ?? []).forEach((it) => {
      const barangId = String(it.barangId);
      const existing = mergedByBarangId.get(barangId);
      if (existing) {
        existing.stokFisik += it.stokFisik ?? 0;
        duplicateCount += 1;
        return;
      }
      mergedByBarangId.set(barangId, { key: nextRowKey(), barangId, stokFisik: it.stokFisik ?? 0 });
      order.push(barangId);
    });
    const rowsFromSession = order.map((barangId) => mergedByBarangId.get(barangId)!);
    if (duplicateCount > 0) {
      toast(
        `Sesi ini punya ${duplicateCount} baris SKU ganda dari sebelumnya — sudah digabung otomatis (Stok Fisik dijumlahkan). Cek lagi angkanya sebelum menyimpan.`,
      );
    }
    setItemRows(rowsFromSession.length > 0 ? rowsFromSession : [emptyRow()]);
    setIsModalOpen(true);
  }

  function updateRow(key: string, patch: Partial<ItemRow>): void {
    setItemRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string): void {
    setItemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function handleSave(): Promise<void> {
    const validRows = itemRows.filter((r) => r.barangId);
    if (!gudangId || !tanggal || validRows.length === 0) {
      toast.error('Gudang, tanggal, dan minimal 1 barang wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: StockOpnamePayload = {
        gudangId: Number(gudangId),
        tanggal,
        catatan,
        items: validRows.map((r) => ({ barangId: Number(r.barangId), stokFisik: r.stokFisik })),
      };
      if (editingId) {
        await inventoryApi.update(editingId, payload);
        toast.success('Sesi Stock Opname berhasil diubah.');
      } else {
        await inventoryApi.create(payload);
        toast.success('Sesi Stock Opname berhasil dibuat (status: Draft).');
      }
      setIsModalOpen(false);
      setEditingId(null);
      await Promise.all([mutate(), mutateStokGudang()]);
    } catch (err) {
      toast.error(friendlyError(err, editingId ? 'Gagal mengubah sesi Stock Opname.' : 'Gagal membuat sesi Stock Opname.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkChange(selectedRows: RawStockOpname[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu sesi draft yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU sesi draft untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: RawStockOpname[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa sesi draft yang mau dihapus.');
      return;
    }
    const nonDraft = selectedRows.filter((r) => r.status !== 'draft');
    if (nonDraft.length > 0) {
      toast.error('Hanya data berstatus draft yang bisa dihapus, silakan batalkan pilihan pada data yang sudah selesai dicatat.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Sesi Terpilih',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} data ini yang masih berstatus draft?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => inventoryApi.remove(String(r.id))));
      toast.success(`${selectedRows.length} sesi berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua sesi gagal dihapus.'));
    }
  }

  async function handleComplete(row: RawStockOpname): Promise<void> {
    const ok = await confirm({
      title: 'Selesaikan Stock Opname?',
      message: `Menyelesaikan ${row.nomorOpname} akan mengganti stok SISTEM di gudang ${row.gudang?.nama ?? 'ini'} untuk tiap SKU pada sesi ini, mengikuti hasil hitung fisik. Stok di gudang lain tidak ikut berubah. Angka "Stok Sistem" di bawah sudah disegarkan mengikuti kondisi terbaru sebelum diterapkan.`,
      confirmLabel: 'Ya, Saya Yakin',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await inventoryApi.complete(String(row.id));
      toast.success('Stock Opname selesai, stok sistem sudah disesuaikan.');
      // Complete() benar-benar mengubah stok gudang — cache ringkasan stok
      // (dipakai untuk figur "Stok Sistem") harus ikut disegarkan, bukan
      // cuma daftar sesinya.
      await Promise.all([mutate(), mutateStokGudang()]);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyelesaikan Stock Opname.'));
    }
  }

  async function handleCancel(row: RawStockOpname): Promise<void> {
    const ok = await confirm({
      title: 'Batalkan Sesi',
      message: `Batalkan sesi ${row.nomorOpname}? Datanya tetap tersimpan untuk arsip (tidak dihapus), tapi tidak akan pernah diterapkan ke stok.`,
      confirmLabel: 'Ya, Batalkan',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await inventoryApi.cancel(String(row.id));
      toast.success('Sesi berhasil dibatalkan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membatalkan sesi.'));
    }
  }

  async function handleDelete(row: RawStockOpname): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Sesi Stock Opname',
      message: `Apakah yakin ingin menghapus data ini? (${row.nomorOpname})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await inventoryApi.remove(String(row.id));
      toast.success('Sesi Stock Opname berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus, silakan cek pastikan masih berstatus Draft.'));
    }
  }

  const columns: DataTableColumn<RawStockOpname>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: RawStockOpname) => (
              <input
                type="checkbox"
                checked={selectedIds.has(String(row.id))}
                onChange={() => toggleSelected(String(row.id))}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<RawStockOpname>,
        ]
      : []),
    { key: 'nomor', header: 'No. Opname', render: (row) => row.nomorOpname },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudang?.nama ?? '-' },
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    {
      key: 'kode-barang',
      header: 'Kode Barang',
      render: (row) => {
        const codes = (row.items ?? []).map((it) => it.barang?.kodeBarang).filter(Boolean) as string[];
        if (codes.length === 0) return '-';
        return codes.length === 1 ? codes[0] : `${codes[0]} +${codes.length - 1} lainnya`;
      },
    },
    { key: 'items', header: 'Jumlah Jenis Barang', align: 'right', render: (row) => row.items?.length ?? 0 },
    {
      key: 'selisih',
      header: 'Selisih',
      render: (row) => <SelisihBadge count={countSelisihItems(row)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = SO_STATUS_META[row.status] ?? GENERIC_STATUS_META.selesai;
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openDetail(row)}
            title="Lihat rincian hasil hitung"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {row.status === 'draft' && canCreateOpname ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Ubah"
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.status === 'draft' && canCompleteOpname ? (
            <button
              type="button"
              onClick={() => handleComplete(row)}
              title="Selesaikan & terapkan ke stok"
              className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.status === 'draft' && canCompleteOpname ? (
            <button
              type="button"
              onClick={() => handleCancel(row)}
              title="Batalkan (tanpa diterapkan ke stok)"
              className="rounded p-1 text-textMuted hover:bg-warningBg hover:text-warningText"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.status === 'draft' && isStaff ? (
            <button
              type="button"
              onClick={() => handleDelete(row)}
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
    <PageShell title="Manajemen Inventaris" breadcrumb="Manajemen / Manajemen Inventaris">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Sesi', value: serverPagination.total ?? rows.length },
          { id: 'draft', label: 'Draft', value: rows.filter((r) => r.status === 'draft').length },
          { id: 'selesai', label: 'Selesai', value: rows.filter((r) => r.status === 'selesai').length },
          { id: 'selisih', label: 'Sesi dengan Selisih', value: sesiDenganSelisihCount },
        ]}
      />
      <p className="text-xs text-textMuted">
        Selesaikan sesi di sini untuk menerapkan hasil hitung fisik ke stok sistem — lihat hasilnya di{' '}
        <Link href="/inventory" className="font-semibold text-accentDark hover:underline">
          Inventaris
        </Link>{' '}
        (ringkasan stok terkini per SKU).
      </p>

      <DataTable
        title="Sesi Stock Opname"
        description={
          isBulkMode
            ? `Mode Modify aktif ${selectedIds.size}. Silakan Pilih data per baris lalu gunakan Change/Delete di atas.`
            : 'Sesi hitung fisik stok per gudang selesaikan untuk menerapkan selisih ke stok sistem'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        visibleActions={['add', 'change', 'delete', 'export', 'print', 'modify']}
        module="stock_opname"
        serverPagination={serverPagination}
        toolbar={<TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nomor opname......" />}
        onRowAction={(action) => {
          const selectedRows = rows.filter((r) => selectedIds.has(String(r.id)));
          switch (action) {
            case 'add':
              openCreateModal();
              return;
            case 'modify':
              setIsBulkMode((prev) => !prev);
              setSelectedIds(new Set());
              return;
            case 'change':
              handleBulkChange(selectedRows);
              return;
            case 'delete':
              handleBulkDelete(selectedRows);
              return;
            case 'export':
            case 'print': {
              const exportColumns = [
                { header: 'No. Opname', accessor: (row: (typeof rows)[number]) => row.nomorOpname },
                { header: 'Gudang', accessor: (row: (typeof rows)[number]) => row.gudang?.nama ?? '-' },
                { header: 'Tanggal', accessor: (row: (typeof rows)[number]) => formatTanggalPanjang(row.tanggal) },
                { header: 'Jumlah Jenis Barang', accessor: (row: (typeof rows)[number]) => row.items?.length ?? 0 },
                { header: 'Status', accessor: (row: (typeof rows)[number]) => row.status },
              ];
              const pdfMeta = {
                title: 'Rekap Data Stock Opname',
                subtitle: 'Manajemen / Manajemen Inventaris',
                description: 'Riwayat sesi di hitung berdasarkan fisik stok (stock opname) per gudang, beserta jumlah jenis barang yang dihitung dan status penerapannya ke stok sistem.',
              };
              const granularity: GranularityConfig<RawStockOpname> = {
                dateAccessor: (row) => row.tanggal,
                sumHeaders: ['Jumlah Jenis Barang'],
                groupKeyHeader: 'Gudang',
              };
              if (action === 'export') {
                requestExport(rows, exportColumns, 'sesi-stock-opname', pdfMeta, granularity);
              } else {
                printRowsToPdf(rows, exportColumns, { ...pdfMeta, generatedBy: user?.fullName });
              }
              return;
            }
            default:
              return;
          }
        }}
      />
      {exportDialog}

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Sesi Stock Opname' : 'Sesi Stock Opname Baru'}
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
        <Select
          label="Gudang"
          value={gudangId}
          onChange={(e) => setGudangId(e.target.value)}
          placeholder="Pilih gudang"
          options={(warehouseList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
        />
        <p className="-mt-2 rounded-md bg-accentSoft px-3 py-2 text-xs text-textMuted">
          &quot;Stok Sistem&quot; di bawah dihitung khusus untuk gudang yang dipilih (bukan gabungan semua
          gudang) dan selalu angka terkini — jadi kalau sebelumnya sempat tercatat 0 padahal
          barangnya sudah ada secara fisik, cek dulu apakah Barang Masuk untuk barang ini sudah
          diselesaikan (bukan masih Draft) di gudang yang sama.
          {editingId ? (
            <>
              {' '}
              Saat disimpan, Stok Sistem &amp; Selisih untuk SEMUA baris di sesi ini akan dihitung
              ulang dari kondisi terkini — bukan cuma baris yang Anda ubah — supaya angkanya
              tetap akurat.
            </>
          ) : null}
        </p>
        <Input label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        <Input label="Catatan (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Hasil Hitung Fisik</p>
            <button
              type="button"
              onClick={() => setItemRows((prev) => [...prev, emptyRow()])}
              className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Baris
            </button>
          </div>
          {itemRows.map((row, index) => (
            <div key={row.key} className="flex flex-col gap-3 rounded-md border border-borderSoft bg-neutralBg/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-textMuted">Baris {index + 1}</span>
                {itemRows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-xs text-dangerText hover:underline"
                  >
                    Hapus baris
                  </button>
                ) : null}
              </div>
              <Select
                label="Barang"
                value={row.barangId}
                onChange={(e) => updateRow(row.key, { barangId: e.target.value })}
                placeholder="Pilih barang"
                options={(itemList?.data ?? [])
                  .filter((it) => it.id === row.barangId || !itemRows.some((r) => r.barangId === it.id))
                  .map((it) => ({ label: `${it.sku} — ${it.name}`, value: it.id }))}
              />
              {row.barangId ? (
                <p className="text-xs text-textMuted">
                  Stok sistem saat ini di gudang terpilih:{' '}
                  <span className="font-semibold text-text">
                    {gudangId ? liveStokSistem(row.barangId) : 'pilih gudang dulu'}
                  </span>
                </p>
              ) : null}
              <NumberField
                label="Stok Fisik (hasil hitung)"
                value={row.stokFisik}
                onValueChange={(value) => updateRow(row.key, { stokFisik: value })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={detailFor !== null}
        title={detailFor ? `Rincian — ${detailFor.nomorOpname}` : 'Rincian Sesi'}
        onClose={() => setDetailFor(null)}
        footer={
          <Button variant="secondary" onClick={() => setDetailFor(null)}>
            Tutup
          </Button>
        }
      >
        {isLoadingDetail ? (
          <p className="text-sm text-textMuted">Memuat rincian...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
              <p>Gudang: <span className="font-medium text-text">{detailFor?.gudang?.nama ?? '-'}</span></p>
              <p>Tanggal: <span className="font-medium text-text">{detailFor ? formatDate(detailFor.tanggal) : '-'}</span></p>
            </div>
            {detailFor?.catatan ? (
              <p className="text-xs text-textMuted">Catatan: {detailFor.catatan}</p>
            ) : null}
            <div className="flex flex-col gap-2">
              {(detailFor?.items ?? []).length === 0 ? (
                <p className="text-sm text-textMuted">Belum ada barang dihitung di sesi ini.</p>
              ) : (
                (detailFor?.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 rounded-md border border-borderSoft px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-text">
                        {item.barang?.nama ?? `Barang #${item.barangId}`}
                      </p>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-textMuted">
                        <span>Sistem: {item.stokSistem}</span>
                        <span>Fisik: {item.stokFisik}</span>
                        <span className={item.selisih !== 0 ? 'font-semibold text-dangerText' : 'font-semibold text-successText'}>
                          Selisih: {item.selisih}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-textMuted">
                      <span>Kode Barang: <span className="font-medium text-text">{item.barang?.kodeBarang ?? '-'}</span></span>
                      {item.barang?.merek ? <span>Merek: <span className="font-medium text-text">{item.barang.merek}</span></span> : null}
                      {item.barang?.tipe ? <span>Tipe: <span className="font-medium text-text">{item.barang.tipe}</span></span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}