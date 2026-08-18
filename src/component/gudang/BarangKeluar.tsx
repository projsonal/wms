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
import { Input, Select, NumberField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { goodsOutApi, itemsApi, kategoriApi, warehousesApi, rakApi, type KategoriRaw } from '@/lib/api/modules';
import { HttpError } from '@/lib/api/client';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { RawBarangKeluar } from '@/lib/api/raw-types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

interface ItemRow {
  /** ID unik sisi klien — lihat catatan panjang di GoodsIn.tsx ItemRow.key
   * soal kenapa ini WAJIB, bukan cuma soal gaya (SonarQube S6479). */
  key: string;
  barangId: string;
  /** Opsional — rak ASAL pengambilan barang, mengurangi Rak.Terisi rak itu
   * sebesar qty saat dokumen diselesaikan (lihat catatan RakID di
   * GoodsIn.tsx, konsepnya sama tapi arah sebaliknya). Rak di sini TIDAK
   * dikaitkan ke SKU tertentu (lihat model.Rak backend — kapasitas/terisi
   * murni angka unit generik per rak, bukan per barang), jadi operator
   * cukup pilih rak fisik tempat dia mengambil barang, apa pun jenisnya. */
  rakId: string;
  qty: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

const EMPTY_ITEM_ROW: Omit<ItemRow, 'key'> = { barangId: '', rakId: '', qty: 1 };

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

export function BarangKeluarContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canEditBK = isStaff || can('barang_keluar', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [kategoriId, setKategoriId] = useState('');
  const { data: kategoriList } = useSWR<KategoriRaw[]>('kategori-list', () => kategoriApi.list());
  const { data: barangList } = useSWR('items-for-goods-out', () => itemsApi.list({ pageSize: 200 }));
  const { data: gudangList } = useSWR('warehouses-for-goods-out', () => warehousesApi.list({ pageSize: 100 }));

  const { data, isLoading, mutate } = useSWR(['goods-out', kategoriId], () =>
    goodsOutApi.list(kategoriId ? { kategori_id: kategoriId } : undefined),
  );
  const rows = data?.data ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [penerima, setPenerima] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  // Sama pola dengan BarangMasuk.tsx: daftar rak KHUSUS gudang asal yang
  // dipilih, reset tiap kali gudang berganti (lihat handleGudangChange).
  const { data: rakListResult } = useSWR(
    gudangId ? ['racks-for-goods-out', gudangId] : null,
    () => rakApi.list(Number(gudangId), { pageSize: 200 }),
  );
  const rakOptions = (rakListResult?.data ?? []).map((r) => ({
    label: `${r.kodeRak} (${r.terisi}/${r.kapasitas} unit)`,
    value: String(r.id),
  }));

  function handleGudangChange(nextGudangId: string): void {
    setGudangId(nextGudangId);
    setItemRows((prev) => prev.map((row) => ({ ...row, rakId: '' })));
  }

  function openCreateModal(): void {
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKeperluan('');
    setPenerima('');
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
      await goodsOutApi.create({
        gudang_id: Number(gudangId),
        tanggal,
        keperluan,
        penerima,
        items: items.map((r) => ({
          barang_id: Number(r.barangId),
          rak_id: r.rakId ? Number(r.rakId) : undefined,
          qty: r.qty,
        })),
      });
      toast.success('Dokumen barang keluar berhasil dibuat (status: draft).');
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membuat dokumen barang keluar.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(row: RawBarangKeluar): Promise<void> {
    if (row.status !== 'draft') {
      toast.error('Hanya dokumen berstatus draft yang bisa dihapus.');
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
    { header: 'Tanggal', accessor: (r: RawBarangKeluar) => r.tanggal },
    { header: 'Nomor Pengeluaran', accessor: (r: RawBarangKeluar) => r.nomorPengeluaran },
    { header: 'Gudang', accessor: (r: RawBarangKeluar) => r.gudang?.nama ?? '-' },
    { header: 'Keperluan', accessor: (r: RawBarangKeluar) => r.keperluan },
    { header: 'Status', accessor: (r: RawBarangKeluar) => r.status },
  ];
  const BK_PDF_META = {
    title: 'Rekap Data Gudang — Barang Keluar',
    subtitle: 'Pengelolaan / Barang Keluar',
    description: 'Riwayat dokumen pengeluaran barang dari gudang beserta keperluan dan status prosesnya (draft/selesai/dibatalkan).',
  };

  function handleExport(): void {
    requestExport(rows, BK_EXPORT_COLUMNS, 'daftar-barang-keluar', BK_PDF_META);
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
    if (action === 'add') openCreateModal();
    if (action === 'export') handleExport();
    if (action === 'print') {
      printRowsToPdf(rows, BK_EXPORT_COLUMNS, { ...BK_PDF_META, generatedBy: user?.fullName });
    }
  }

  const columns: DataTableColumn<RawBarangKeluar>[] = [
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
          {row.status === 'draft' && canEditBK ? (
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
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel. */}
      <DataTable
        title="Riwayat Barang Keluar"
        description="Catatan pengeluaran barang dari gudang"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="barang_keluar"
        /* Sama seperti Barang Masuk: dokumen berstatus, bukan katalog
         * bebas-edit, jadi cuma Add/Export/Print yang punya aksi nyata di
         * toolbar (Change/Delete/Modify/Protect butuh "baris terpilih"
         * yang tabel ini tidak punya, sebelumnya no-op walau tombolnya
         * tampil). Ubah status per baris & hapus draft ada lewat ikon di
         * kolom paling kanan. */
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
                label="Ambil dari Rak (opsional)"
                value={row.rakId}
                onChange={(e) => updateItemRow(index, { rakId: e.target.value })}
                placeholder={gudangId ? 'Tidak diambil dari rak tertentu' : 'Pilih gudang asal dulu'}
                options={rakOptions}
                disabled={!gudangId}
              />
              <NumberField
                label="Qty"
                value={row.qty}
                onValueChange={(value) => updateItemRow(index, { qty: value })}
              />
            </div>
          ))}
        </div>
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
