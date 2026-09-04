'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Trash2, Pencil, CheckCircle2, XCircle, Camera, PackageCheck } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { ScanSnButton } from '@/component/ui/ScanSnButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { barangRusakApi, itemsApi, warehousesApi, type BarangRusakPayload } from '@/lib/api/modules';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { BARANG_RUSAK_STATUS_META } from '@/lib/utils/status';
import { useAuthedImage } from '@/lib/hooks/useAuthedImage';
import type { BarangRusak } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<BarangRusakPayload> = {
  labelBarang: '',
  namaBarang: '',
  merek: '',
  kodeBarang: '',
  serialNumber: '',
  keterangan: '',
};

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus laporan barang rusak ini?';

function FotoRusakThumbnail({ fotoUrl }: Readonly<{ fotoUrl?: string }>): React.JSX.Element {
  const url = useAuthedImage(fotoUrl);
  if (!fotoUrl) {
    return <span className="text-xs text-textMuted">-</span>;
  }
  if (!url) {

    return <div className="h-10 w-10 animate-pulse rounded-md bg-neutralBg" />;
  }
  return (

    <img src={url} alt="Bukti kerusakan" className="h-10 w-10 rounded-md border border-borderSoft object-cover" />
  );
}

function BarangRusakBody(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const [filterBarangId, setFilterBarangId] = useState('');
  const { rows, isLoading, error, mutate, serverPagination } = useServerPaginatedList(
    'barang-rusak',
    barangRusakApi,
    { search: searchTerm || undefined, barang_id: filterBarangId || undefined },
  );
  const { data: summary, mutate: mutateSummary } = useSWR('barang-rusak-summary', () => barangRusakApi.summary());
  const { data: barangList } = useSWR('items-for-barang-rusak', () => itemsApi.list({ pageSize: 200 }));
  const { data: gudangListForSimpan } = useSWR('warehouses-for-barang-rusak', () => warehousesApi.list({ pageSize: 100 }));

  const [simpanGudangTarget, setSimpanGudangTarget] = useState<BarangRusak | null>(null);
  const [simpanGudangId, setSimpanGudangId] = useState('');
  const [isSimpanGudangSaving, setIsSimpanGudangSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BarangRusakPayload>>(EMPTY_FORM);
  // barangId dipisah dari `form` karena Select butuh value string, sedangkan
  // BarangRusakPayload.barangId bertipe number|null (dikonversi saat submit).
  const [barangId, setBarangId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fotoTargetId, setFotoTargetId] = useState<string | null>(null);
  const [uploadingFotoId, setUploadingFotoId] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

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

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBarangId('');
    setIsModalOpen(true);
  }

  function openEditModal(row: BarangRusak): void {
    if (row.status !== 'pengecekan') {
      toast.error('Data yang sudah diperiksa tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      labelBarang: row.labelBarang,
      namaBarang: row.namaBarang,
      merek: row.merek ?? '',
      kodeBarang: row.kodeBarang ?? '',
      serialNumber: row.serialNumber ?? '',
      keterangan: row.keterangan ?? '',
    });
    setBarangId(row.barangId ?? '');
    setIsModalOpen(true);
  }

  function handleBarangPicked(value: string): void {
    setBarangId(value);
    const selected = barangList?.data.find((b) => b.id === value);
    if (selected) {
      // Auto-isi Label/Kode, Nama, Merek & Kode Barang (SKU) dari katalog
      // Kelola Barang supaya konsisten dengan data asli — tetap boleh
      // diedit manual (mis. kalau barang yang rusak belum terdaftar di
      // katalog, atau mereknya beda dari catatan katalog).
      setForm((prev) => ({
        ...prev,
        labelBarang: selected.sku,
        namaBarang: selected.name,
        merek: selected.merek ?? '',
        kodeBarang: selected.sku,
      }));
    }
  }

  function triggerFotoUpload(row: BarangRusak): void {
    setFotoTargetId(row.id);
    fotoInputRef.current?.click();
  }

  async function handleFotoChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    const targetId = fotoTargetId;
    if (!file || !targetId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 2MB.');
      return;
    }
    setUploadingFotoId(targetId);
    try {
      await barangRusakApi.uploadFoto(targetId, file);
      toast.success('Foto bukti berhasil diunggah.');
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengunggah foto bukti.'));
    } finally {
      setUploadingFotoId(null);
      setFotoTargetId(null);
    }
  }

  async function handleSave(): Promise<void> {
    if (!form.labelBarang || !form.namaBarang) {
      toast.error('Label/kode barang dan nama barang wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: BarangRusakPayload = {
        barangId: barangId ? Number(barangId) : null,
        labelBarang: form.labelBarang,
        namaBarang: form.namaBarang,
        merek: form.merek ?? '',
        kodeBarang: form.kodeBarang ?? '',
        serialNumber: form.serialNumber ?? '',
        keterangan: form.keterangan ?? '',
      };
      if (editingId) {
        await barangRusakApi.update(editingId, payload);
        toast.success('Laporan barang rusak berhasil diperbarui.');
      } else {
        await barangRusakApi.create(payload);
        toast.success('Laporan berhasil dibuat, menunggu pengecekan fisik terhadap barang.');
      }
      setIsModalOpen(false);
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan laporan barang rusak.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: BarangRusak): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Laporan Barang Rusak',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await barangRusakApi.remove(row.id);
      toast.success('Laporan berhasil dihapus.');
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus laporan.'));
    }
  }

  async function handleInspeksi(row: BarangRusak, jenis: 'retur' | 'rusak'): Promise<void> {
    const ok = await confirm({
      title: jenis === 'retur' ? 'Tandai Bisa Diretur?' : 'Tandai Rusak (Tidak Bisa Diretur)?',
      message:
        jenis === 'retur'
          ? 'Hasil pengecekan fisik akan dikunci sebagai "Bisa Diretur" barang akan diproses retur.'
          : 'Hasil pengecekan fisik akan dikunci sebagai "Rusak" barang tidak bisa diretur.',
      confirmLabel: 'Ya, Simpan',
      variant: jenis === 'retur' ? 'default' : 'danger',
    });
    if (!ok) return;
    try {
      await barangRusakApi.inspeksi(row.id, jenis);
      toast.success('Hasil pengecekan berhasil disimpan.');
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan hasil pengecekan.'));
    }
  }

  function openSimpanGudangModal(row: BarangRusak): void {
    setSimpanGudangTarget(row);
    setSimpanGudangId('');
  }

  async function handleSimpanKeGudang(): Promise<void> {
    if (!simpanGudangTarget) return;
    if (!simpanGudangId) {
      toast.error('Pilih gudang tujuan terlebih dahulu.');
      return;
    }
    setIsSimpanGudangSaving(true);
    try {
      await barangRusakApi.simpanKeGudang(simpanGudangTarget.id, simpanGudangId);
      toast.success('Barang berhasil disimpan kembali ke stok gudang.');
      setSimpanGudangTarget(null);
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan barang ke gudang.'));
    } finally {
      setIsSimpanGudangSaving(false);
    }
  }

  const EXPORT_COLUMNS = [
    { header: 'Tanggal Lapor', accessor: (r: BarangRusak) => formatTanggalPanjang(r.createdAt) },
    { header: 'Label/Kode Barang', accessor: (r: BarangRusak) => r.labelBarang },
    { header: 'Kode Barang (SKU)', accessor: (r: BarangRusak) => r.kodeBarang ?? '-' },
    { header: 'Nama Barang', accessor: (r: BarangRusak) => r.namaBarang },
    { header: 'Merek', accessor: (r: BarangRusak) => r.merek ?? '-' },
    { header: 'Tipe', accessor: (r: BarangRusak) => r.tipe ?? '-' },
    { header: 'Serial Number', accessor: (r: BarangRusak) => r.serialNumber ?? '-' },
    { header: 'Keterangan', accessor: (r: BarangRusak) => r.keterangan ?? '-' },
    { header: 'Pelapor', accessor: (r: BarangRusak) => r.pelapor ?? '-' },
    { header: 'Status', accessor: (r: BarangRusak) => r.status },
    { header: 'Pemeriksa', accessor: (r: BarangRusak) => r.pemeriksa ?? '-' },
  ];
  const PDF_META = {
    title: 'Rekap Data Barang Rusak',
    subtitle: 'Menu Utama / Barang Rusak',
    description: 'Kumpulan Data Barang rusak/retur beserta status hasil pengecekan fisik.',
  };
  const GRANULARITY: GranularityConfig<BarangRusak> = {
    dateAccessor: (r) => r.createdAt,
    sumHeaders: [],
    groupKeyHeader: 'Status',
  };

  function handleExport(): void {
    requestExport(rows, EXPORT_COLUMNS, 'daftar-barang-rusak', PDF_META, GRANULARITY);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, EXPORT_COLUMNS, { ...PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: BarangRusak[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu laporan yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU laporan untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: BarangRusak[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Silakan Aktifkan "Modify" terlebih dahulu untuk memilih salah satu data yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Laporan Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => barangRusakApi.remove(r.id)));
      toast.success(`${selectedRows.length} laporan berhasil dihapus.`);
      setSelectedIds(new Set());
      mutate();
      mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua laporan gagal dihapus.'));
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
      default:
        return;
    }
  }

  const columns: DataTableColumn<BarangRusak>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: BarangRusak) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<BarangRusak>,
        ]
      : []),
    {
      key: 'foto',
      header: 'Foto',
      render: (row) => <FotoRusakThumbnail fotoUrl={row.fotoUrl} />,
    },
    { key: 'label', header: 'Label / Kode', render: (row) => <span className="font-mono text-xs">{row.labelBarang}</span> },
    { key: 'kode-barang', header: 'Kode Barang (SKU)', render: (row) => <span className="font-mono text-xs">{row.kodeBarang ?? '-'}</span> },
    { key: 'nama', header: 'Nama Barang', render: (row) => row.namaBarang },
    {
      key: 'merek-tipe',
      header: 'Merek / Tipe',
      render: (row) => [row.merek, row.tipe].filter(Boolean).join(' ') || '-',
    },
    { key: 'sn', header: 'Serial Number', render: (row) => <span className="font-mono text-xs">{row.serialNumber ?? '-'}</span> },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan || '-' },
    { key: 'pelapor', header: 'Pelapor', render: (row) => row.pelapor ?? '-' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = BARANG_RUSAK_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
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
            onClick={() => triggerFotoUpload(row)}
            disabled={uploadingFotoId === row.id}
            title="Unggah Foto Bukti"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          {isStaff && row.status === 'retur' ? (
            <button
              type="button"
              onClick={() => openSimpanGudangModal(row)}
              title="Simpan Kembali ke Stok Gudang (pengganti fitur retur ke supplier)"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-textMuted hover:bg-successBg hover:text-successText"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              <span className="text-xs">Simpan ke Gudang</span>
            </button>
          ) : null}
          {isStaff && row.status === 'rusak' ? (
            <span
              title="Barang ini dinyatakan rusak total saat pengecekan fisik, jadi tidak bisa dikembalikan sebagai stok — laporan ini sudah final, tidak ada tindak lanjut lagi di sistem (mis. pembuangan fisik dilakukan manual di luar sistem)."
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-textMuted"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rusak total
            </span>
          ) : null}
          {isStaff && row.status === 'pengecekan' ? (
            <>
              <button
                type="button"
                onClick={() => handleInspeksi(row, 'retur')}
                title="Tandai Bisa Diretur"
                className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInspeksi(row, 'rusak')}
                title="Tandai Rusak"
                className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {row.status === 'pengecekan' ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Edit"
              className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
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
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Barang Rusak" breadcrumb="Manajemen / Barang Rusak">
      <StatsRow
        stats={[
          { id: 'pengecekan', label: 'Menunggu Pengecekan', value: summary?.pengecekan ?? 0 },
          { id: 'retur', label: 'Bisa Diretur', value: summary?.retur ?? 0 },
          { id: 'rusak', label: 'Rusak', value: summary?.rusak ?? 0 },
          { id: 'total', label: 'Total Laporan', value: summary?.total ?? 0 },
        ]}
      />

      <DataTable
        title="Daftar Laporan Barang Rusak"
        description={
          isBulkMode
            ? `Mode Modify aktif ${selectedIds.size}. Silakan pilih data per baris lalu gunakan Change/Delete di atas.`
            : "Laporan barang rusak/retur status default 'Menunggu Pengecekan' sampai diperiksa fisik oleh Admin/Super Admin"
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        visibleActions={['add', 'change', 'delete', 'export', 'print', 'modify']}
        module="barang_rusak"
        serverPagination={serverPagination}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
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
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari label/nama barang......" />
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Laporan Barang Rusak' : 'Lapor Barang Rusak'}
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
        <Select
          label="Pilih dari Kelola Barang (opsional)"
          value={barangId}
          onChange={(event) => handleBarangPicked(event.target.value)}
          placeholder="Barang belum terdaftar / isi manual di bawah"
          options={(barangList?.data ?? []).map((b) => {
            const details = [b.merek, b.tipe].filter(Boolean).join(' ');
            const detailsSuffix = details ? ` (${details})` : '';
            return { label: `${b.sku} — ${b.name}${detailsSuffix}`, value: b.id };
          })}
        />
        <p className="-mt-2 text-xs text-textMuted">
          Kalau dipilih, Label/Kode & Nama Barang di bawah otomatis terisi dari SKU aslinya (tetap
          bisa diedit), dan Merek/Tipe akan ikut tercatat di laporan ini.
        </p>
        <Input
          label="Label / Kode Barang"
          value={form.labelBarang ?? ''}
          onChange={(event) => setForm({ ...form, labelBarang: event.target.value })}
          placeholder="mis. BRG-0001 atau BBU-RSD-0001"
        />
        <Input
          label="Nama Barang"
          value={form.namaBarang ?? ''}
          onChange={(event) => setForm({ ...form, namaBarang: event.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Merek (opsional)"
            value={form.merek ?? ''}
            onChange={(event) => setForm({ ...form, merek: event.target.value })}
            placeholder="mis. Huawei"
          />
          <Input
            label="Kode Barang / SKU (opsional)"
            value={form.kodeBarang ?? ''}
            onChange={(event) => setForm({ ...form, kodeBarang: event.target.value })}
            placeholder="mis. WRSD-0001"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Serial Number (opsional)"
              value={form.serialNumber ?? ''}
              onChange={(event) => setForm({ ...form, serialNumber: event.target.value })}
              placeholder="apabila barang memiliki Serial Number (SN)"
            />
          </div>
          <ScanSnButton onScan={(value) => setForm((prev) => ({ ...prev, serialNumber: value }))} />
        </div>
        <Input
          label="Keterangan (opsional)"
          value={form.keterangan ?? ''}
          onChange={(event) => setForm({ ...form, keterangan: event.target.value })}
          placeholder="Kondisi kerusakan yang terlihat"
        />
      </Modal>

      <Modal
        isOpen={simpanGudangTarget !== null}
        title="Simpan Kembali ke Stok Gudang"
        onClose={() => setSimpanGudangTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSimpanGudangTarget(null)}>
              Batal
            </Button>
            <Button
              onClick={handleSimpanKeGudang}
              loading={isSimpanGudangSaving}
              disabled={!simpanGudangTarget?.barangId}
            >
              Simpan ke Gudang
            </Button>
          </>
        }
      >
        <p className="text-xs text-textMuted">
          Fitur retur langsung ke supplier sudah tidak tersedia di aplikasi ini. Sebagai gantinya,
          barang &quot;{simpanGudangTarget?.namaBarang}&quot; ({simpanGudangTarget?.labelBarang}) yang
          berstatus Bisa Diretur (masih layak pakai, bukan rusak total) akan ditambahkan kembali
          sebagai stok (+1 unit) ke gudang yang kamu pilih di bawah, supaya tidak menggantung tanpa
          tindak lanjut. Proses retur fisik ke supplier tetap dilakukan manual di luar sistem. Untuk
          barang yang dinyatakan Rusak Total (bukan Bisa Diretur), fitur ini tidak berlaku karena
          barangnya memang tidak bisa dikembalikan sebagai stok.
        </p>
        {!simpanGudangTarget?.barangId ? (
          <p className="rounded-md bg-warningBg px-3 py-2 text-xs text-warningText">
            Laporan ini belum tertaut ke katalog Kelola Barang, jadi stoknya tidak bisa ditambahkan
            otomatis. Tautkan dulu barangnya lewat tombol Ubah sebelum menyimpan ke gudang.
          </p>
        ) : (
          <Select
            label="Gudang Tujuan"
            value={simpanGudangId}
            onChange={(event) => setSimpanGudangId(event.target.value)}
            placeholder="Pilih gudang"
            options={(gudangListForSimpan?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
        )}
      </Modal>

      <input
        ref={fotoInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={handleFotoChange}
      />
      {exportDialog}
    </PageShell>
  );
}

export function BarangRusakContent(): React.JSX.Element {
  return <BarangRusakBody />;
}