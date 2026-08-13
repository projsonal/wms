'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Trash2, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select, NumberField, CurrencyField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { goodsInApi, itemsApi, kategoriApi, warehousesApi, type KategoriRaw } from '@/lib/api/modules';
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
  const [isSaving, setIsSaving] = useState(false);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  function openCreateModal(): void {
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
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
      await goodsInApi.create({
        gudang_id: Number(gudangId),
        tanggal,
        catatan,
        items: items.map((r) => ({
          barang_id: Number(r.barangId),
          qty: r.qty,
          harga_satuan: r.hargaSatuan,
        })),
      });
      toast.success('Dokumen barang masuk berhasil dibuat (status: draft).');
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membuat dokumen barang masuk.'));
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

  async function handleRowAction(action: TableRowAction): Promise<void> {
    if (action === 'add') openCreateModal();
    if (action === 'export') handleExport();
    if (action === 'print') {
      printRowsToPdf(rows, BM_EXPORT_COLUMNS, { ...BM_PDF_META, generatedBy: user?.fullName });
    }
  }

  const columns: DataTableColumn<RawBarangMasuk>[] = [
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
        description="Catatan penerimaan barang ke gudang"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="barang_masuk"
        /* Barang Masuk adalah dokumen berstatus (draft/selesai/dibatalkan),
         * BUKAN katalog yang barisnya diedit bebas — makanya cuma
         * Add/Export/Print yang punya aksi nyata di toolbar. Change,
         * Delete, Modify, Protect butuh konsep "baris terpilih" yang
         * tabel ini tidak punya; sebelumnya tombol itu tetap tampil tapi
         * onClick-nya no-op (handleRowAction tidak menanganinya) —
         * makanya kelihatan "tidak berfungsi". Aksi ubah status per baris
         * (Selesaikan/Batalkan) & hapus draft sudah ada lewat ikon di
         * kolom paling kanan tabel. */
        visibleActions={['add', 'export', 'print']}
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
        title="Tambah Barang Masuk"
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
            label="Gudang Tujuan"
            value={gudangId}
            onChange={(e) => setGudangId(e.target.value)}
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
