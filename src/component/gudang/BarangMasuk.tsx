'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Trash2, Pencil, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select, NumberField, CurrencyField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { goodsInApi, itemsApi, kategoriApi, warehousesApi, rakApi, type KategoriRaw } from '@/lib/api/modules';
import { HttpError } from '@/lib/api/client';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { RawBarangMasuk } from '@/lib/api/raw-types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

interface ItemRow {
  /** ID unik sisi klien (BUKAN dari server, dokumen belum disimpan) —
   * dipakai sebagai React key yang stabil supaya menghapus baris di
   * tengah tidak membuat React salah mengaitkan state input ke baris
   * yang salah (risiko nyata kalau key-nya index array, bukan cuma soal
   * gaya penulisan kode — SonarQube menandai ini sebagai code smell tepat
   * karena alasan ini: S6479). */
  key: string;
  barangId: string;
  /** Opsional — TANPA sensor IoT, ini satu-satunya cara "Terisi" pada rak
   * (lihat WarehouseManagement.tsx) beranjak dari 0: operator memilih rak
   * tujuan penempatan manual di sini, backend menambah Rak.Terisi sebesar
   * qty begitu dokumen ini diselesaikan (lihat catatan RakID di
   * internal/model/barang_masuk.go). Kosong = barang dicatat masuk tanpa
   * penempatan rak spesifik (rak tetap tercatat kosong). */
  rakId: string;
  qty: number;
  hargaSatuan: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

const EMPTY_ITEM_ROW: Omit<ItemRow, 'key'> = { barangId: '', rakId: '', qty: 1, hargaSatuan: 0 };

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

export function BarangMasukContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canEditBM = isStaff || can('barang_masuk', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [kategoriId, setKategoriId] = useState('');
  const { data: kategoriList } = useSWR<KategoriRaw[]>('kategori-list', () => kategoriApi.list());
  const { data: barangList } = useSWR('items-for-goods-in', () => itemsApi.list({ pageSize: 200 }));
  const { data: gudangList } = useSWR('warehouses-for-goods-in', () => warehousesApi.list({ pageSize: 100 }));

  const { data, isLoading, mutate } = useSWR(['goods-in', kategoriId], () =>
    goodsInApi.list(kategoriId ? { kategori_id: kategoriId } : undefined),
  );
  const rows = data?.data ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  // Mode "Modify" (bulk select) supaya tombol Change/Delete di action bar
  // punya konsep "baris terpilih" — sama pola dengan ItemsManagement.tsx.
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

  // Daftar rak KHUSUS gudang yang dipilih di atas (rak milik gudang lain
  // tidak relevan/tidak valid dipilih di sini). Di-fetch ulang tiap
  // gudangId berganti; lihat handleGudangChange di bawah untuk kenapa
  // rakId tiap baris ikut direset saat itu terjadi.
  const { data: rakListResult } = useSWR(
    gudangId ? ['racks-for-goods-in', gudangId] : null,
    () => rakApi.list(Number(gudangId), { pageSize: 200 }),
  );
  const rakOptions = (rakListResult?.data ?? []).map((r) => ({
    label: `${r.kodeRak} (${r.terisi}/${r.kapasitas} unit)`,
    value: String(r.id),
  }));

  function handleGudangChange(nextGudangId: string): void {
    setGudangId(nextGudangId);
    // Rak yang sudah dipilih di tiap baris jadi tidak valid begitu gudang
    // tujuan berganti (rak terikat ke SATU gudang) — reset supaya tidak
    // ada baris yang diam-diam mengirim rak_id milik gudang yang salah.
    setItemRows((prev) => prev.map((row) => ({ ...row, rakId: '' })));
  }

  function openCreateModal(): void {
    setEditingId(null);
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
  }

  function openEditModal(row: RawBarangMasuk): void {
    if (row.status !== 'Draft') {
      toast.error('Hanya dokumen berstatus draft yang bisa diubah.');
      return;
    }
    setEditingId(String(row.id));
    setGudangId(String(row.gudangId));
    setTanggal(row.tanggal ? row.tanggal.slice(0, 10) : '');
    setCatatan(row.catatan ?? '');
    const rowsFromDoc = (row.items ?? []).map((it) => ({
      key: nextRowKey(),
      barangId: String(it.barangId),
      rakId: it.rakId ? String(it.rakId) : '',
      qty: it.qty ?? 1,
      hargaSatuan: it.hargaSatuan ?? 0,
    }));
    setItemRows(rowsFromDoc.length > 0 ? rowsFromDoc : [{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
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
          rak_id: r.rakId ? Number(r.rakId) : undefined,
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
    const ok = await confirm({
      title: 'Selesaikan Dokumen',
      message: `Selesaikan dokumen ${row.nomorPenerimaan}? Stok & rak akan diperbarui otomatis.`,
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
    { header: 'Tanggal', accessor: (r: RawBarangMasuk) => r.tanggal },
    { header: 'Nomor Penerimaan', accessor: (r: RawBarangMasuk) => r.nomorPenerimaan },
    { header: 'Gudang', accessor: (r: RawBarangMasuk) => r.gudang?.nama ?? '-' },
    { header: 'Status', accessor: (r: RawBarangMasuk) => r.status },
  ];
  const BM_PDF_META = {
    title: 'Rekap Data Gudang — Barang Masuk',
    subtitle: 'Pengelolaan / Barang Masuk',
    description: 'Riwayat dokumen penerimaan barang masuk ke gudang beserta status prosesnya (draft/selesai/dibatalkan).',
  };

  function handleExport(): void {
    requestExport(rows, BM_EXPORT_COLUMNS, 'daftar-barang-masuk', BM_PDF_META);
  }

  async function handleBulkChange(selectedRows: RawBarangMasuk[]): Promise<void> {
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

  async function handleBulkDelete(selectedRows: RawBarangMasuk[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa dokumen draft yang mau dihapus.');
      return;
    }
    const nonDraft = selectedRows.filter((r) => r.status !== 'Draft');
    if (nonDraft.length > 0) {
      toast.error('Hanya dokumen berstatus draft yang bisa dihapus — batalkan pilihan pada dokumen selesai/dibatalkan.');
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
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status] ?? { label: row.status, variant: 'neutral' as const };
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'Draft' && canEditBM ? (
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
          {row.status === 'Draft' && canEditBM ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Ubah"
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.status === 'Draft' && isStaff ? (
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
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel. */}
      <DataTable
        title="Riwayat Barang Masuk"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} dokumen terpilih. Pilih baris lalu pakai Change/Delete di atas.`
            : 'Catatan penerimaan barang ke gudang'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="barang_masuk"
        /* Barang Masuk adalah dokumen berstatus (draft/selesai/dibatalkan).
         * Change/Delete kini aktif lewat mode "Modify" (centang baris di
         * kolom kiri, sama pola dengan Kelola Barang) — TAPI cuma untuk
         * dokumen berstatus draft (dokumen selesai/dibatalkan sudah final,
         * konsisten dengan aturan backend di goodsInApi.remove). "Protect"
         * SENGAJA tidak ditampilkan: modul ini tidak punya kolom
         * is_protected/endpoint Protect di backend (lihat
         * internal/model/barang_masuk.go), beda dengan barang.go yang
         * memangnya punya. Aksi ubah status per baris (Selesaikan/
         * Batalkan) tetap ada lewat ikon di kolom paling kanan tabel. */
        visibleActions={['add', 'change', 'delete', 'export', 'print', 'modify']}
        toolbar={
          <Select
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            placeholder="Semua Kategori"
            options={(kategoriList ?? []).map((k) => ({ label: k.nama, value: String(k.id) }))}
            className="w-44"
          />
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
            <button
              type="button"
              onClick={() => setItemRows((prev) => [...prev, { ...EMPTY_ITEM_ROW, key: nextRowKey() }])}
              className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Baris
            </button>
          </div>

          {itemRows.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-md border border-borderSoft bg-neutralBg/40 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-textMuted">Baris {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItemRow(index)}
                  disabled={itemRows.length === 1}
                  className="flex items-center gap-1 text-xs font-medium text-dangerText hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X className="h-3 w-3" /> Hapus baris
                </button>
              </div>
              <Select
                label="Barang"
                value={row.barangId}
                onChange={(e) => updateItemRow(index, { barangId: e.target.value })}
                placeholder="Pilih barang"
                options={(barangList?.data ?? []).map((b) => ({ label: `${b.sku} — ${b.name}`, value: b.id }))}
              />
              <Select
                label="Tempatkan di Rak (opsional)"
                value={row.rakId}
                onChange={(e) => updateItemRow(index, { rakId: e.target.value })}
                placeholder={gudangId ? 'Tidak ditempatkan ke rak tertentu' : 'Pilih gudang tujuan dulu'}
                options={rakOptions}
                disabled={!gudangId}
              />
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
      {exportDialog}
    </PageShell>
  );
}