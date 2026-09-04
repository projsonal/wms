'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Trash2, History, Pencil } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Input, Select } from '@/component/ui/FormControls';
import { ScanSnButton } from '@/component/ui/ScanSnButton';
import { Modal } from '@/component/ui/Modal';
import { Button } from '@/component/ui/Button';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { barangSerialApi, itemsApi, warehousesApi } from '@/lib/api/modules';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { PAGE_LIMIT_OPTIONS } from '@/lib/hooks/useServerPaginatedList';
import { BARANG_SERIAL_STATUS_META } from '@/lib/utils/status';
import type { BarangSerialUnit, Item } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

export function BarangSerialContent(): JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [barangId, setBarangId] = useState('');
  const [gudangId, setGudangId] = useState('');
  const [status, setStatus] = useState('');

  const { data: barangList } = useSWR('barang-serialized-list', () =>
    itemsApi.list({ pageSize: 200 }),
  );
  const serializedItems = (barangList?.data ?? []).filter((b: Item) => b.isSerialized);
  const { data: gudangList } = useSWR('gudang-list-for-serial', () => warehousesApi.list());

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

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createBarangId, setCreateBarangId] = useState('');
  const [createGudangId, setCreateGudangId] = useState('');
  const [createSerial, setCreateSerial] = useState('');
  const [createCatatan, setCreateCatatan] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  function openCreateModal(): void {
    setCreateBarangId('');
    setCreateGudangId('');
    setCreateSerial('');
    setCreateCatatan('');
    setIsCreateModalOpen(true);
  }

  async function handleCreateUnit(): Promise<void> {
    if (!createBarangId || !createGudangId || !createSerial.trim()) {
      toast.error('Barang, gudang, dan nomor seri wajib diisi.');
      return;
    }
    setIsCreating(true);
    try {
      await barangSerialApi.create({
        barangId: createBarangId,
        gudangId: createGudangId,
        serialNumber: createSerial.trim(),
        catatan: createCatatan,
      });
      toast.success('Unit berhasil didaftarkan, stok barang ikut bertambah.');
      setIsCreateModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mendaftarkan unit.'));
    } finally {
      setIsCreating(false);
    }
  }

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BarangSerialUnit | null>(null);
  const [editGudangId, setEditGudangId] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  function openEditModal(row: BarangSerialUnit): void {
    setEditingUnit(row);
    setEditGudangId(row.warehouseId ?? '');
    setEditCatatan(row.catatan ?? '');
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingUnit) return;
    if (!editGudangId) {
      toast.error('Gudang wajib dipilih.');
      return;
    }
    setIsSavingEdit(true);
    try {
      await barangSerialApi.update(editingUnit.id, { gudangId: editGudangId, catatan: editCatatan });
      toast.success('Unit berhasil diperbarui.');
      setIsEditModalOpen(false);
      setEditingUnit(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memperbarui unit.'));
    } finally {
      setIsSavingEdit(false);
    }
  }

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_LIMIT_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filterResetKey = `${barangId}::${gudangId}::${status}::${searchTerm}::${limit}`;
  const [prevFilterResetKey, setPrevFilterResetKey] = useState(filterResetKey);
  if (filterResetKey !== prevFilterResetKey) {
    setPrevFilterResetKey(filterResetKey);
    setPage(1);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data: listResult, isLoading, error, mutate } = useSWR(
    ['barang-serial-list', barangId, gudangId, status, searchTerm, page, limit],
    () =>
      barangSerialApi.list({
        barangId: barangId || undefined,
        gudangId: gudangId || undefined,
        status: status || undefined,
        search: searchTerm || undefined,
        page,
        pageSize: limit,
      }),
  );
  const rows = listResult?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((listResult?.total ?? 0) / limit));

  const { data: ringkasanTersedia } = useSWR(['barang-serial-count', 'tersedia', barangId, gudangId], () =>
    barangSerialApi.list({ barangId: barangId || undefined, gudangId: gudangId || undefined, status: 'tersedia', pageSize: 1 }),
  );
  const { data: ringkasanTerpasang } = useSWR(['barang-serial-count', 'terpasang', barangId, gudangId], () =>
    barangSerialApi.list({ barangId: barangId || undefined, gudangId: gudangId || undefined, status: 'terpasang', pageSize: 1 }),
  );
  const { data: ringkasanRusak } = useSWR(['barang-serial-count', 'rusak', barangId, gudangId], () =>
    barangSerialApi.list({ barangId: barangId || undefined, gudangId: gudangId || undefined, status: 'rusak', pageSize: 1 }),
  );

  const [riwayatUnit, setRiwayatUnit] = useState<BarangSerialUnit | null>(null);
  const [isLoadingRiwayat, setIsLoadingRiwayat] = useState(false);

  async function openRiwayat(row: BarangSerialUnit): Promise<void> {
    setIsLoadingRiwayat(true);
    try {
      const detail = await barangSerialApi.getById(row.id);
      setRiwayatUnit(detail);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengambil riwayat unit.'));
    } finally {
      setIsLoadingRiwayat(false);
    }
  }

  async function handleUpdateStatus(row: BarangSerialUnit, next: 'tersedia' | 'rusak'): Promise<void> {
    const ok = await confirm({
      title: next === 'rusak' ? 'Tandai Rusak' : 'Tandai Tersedia',
      message:
        next === 'rusak'
          ? `Tandai unit "${row.serialNumber}" sebagai rusak? Unit tidak akan bisa dikeluarkan lagi selama status ini.`
          : `Kembalikan unit "${row.serialNumber}" ke status tersedia?`,
      confirmLabel: 'Ya, Lanjutkan',
      variant: next === 'rusak' ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await barangSerialApi.updateStatus(row.id, next);
      toast.success('Status unit berhasil diperbarui.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memperbarui status unit.'));
    }
  }

  async function handleDelete(row: BarangSerialUnit): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Unit',
      message: `Hapus unit dengan SN "${row.serialNumber}"? Gunakan ini hanya untuk data yang salah input.`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await barangSerialApi.remove(row.id);
      toast.success('Unit berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus unit.'));
    }
  }

  function handleBulkChange(selectedRows: BarangSerialUnit[]): void {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu unit yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU unit untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: BarangSerialUnit[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa unit yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Unit Terpilih',
      message: `Hapus ${selectedRows.length} unit terpilih? Gunakan ini hanya untuk data yang salah input.`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => barangSerialApi.remove(r.id)));
      toast.success(`${selectedRows.length} unit berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua unit gagal dihapus.'));
    }
  }

  const EXPORT_COLUMNS = [
    { header: 'Nomor Seri', accessor: (r: BarangSerialUnit) => r.serialNumber },
    { header: 'Barang', accessor: (r: BarangSerialUnit) => r.barangNama ?? `#${r.barangId}` },
    { header: 'Status', accessor: (r: BarangSerialUnit) => BARANG_SERIAL_STATUS_META[r.status]?.label ?? r.status },
    { header: 'Gudang', accessor: (r: BarangSerialUnit) => r.warehouseName ?? '-' },
    { header: 'Diperbarui', accessor: (r: BarangSerialUnit) => formatTanggalPanjang(r.updatedAt) },
  ];
  const PDF_META = {
    title: 'Rekap Data Barang yang memiliki Serial Number',
    subtitle: 'Pengelolaan / Unit Barang (Nomor Seri)',
    description: 'Kumpulan Data barang fisik yang memiliki Serial Number (SN), beserta status & lokasi terkini.',
  };
  const SERIAL_GRANULARITY: GranularityConfig<BarangSerialUnit> = {
    dateAccessor: (r) => r.updatedAt,
    sumHeaders: [],
    groupKeyHeader: 'Barang',
  };

  async function fetchAllForExport(): Promise<BarangSerialUnit[] | null> {
    try {
      const full = await barangSerialApi.list({
        barangId: barangId || undefined,
        gudangId: gudangId || undefined,
        status: status || undefined,
        search: searchTerm || undefined,
        pageSize: 100,
      });
      if (full.total > 100) {
        toast.error(
          `Data yang cocok filter ada ${full.total} unit, tapi export/print dibatasi karena persempit filter (pilih barang/gudang tertentu) dulu supaya semua ikut ter-export.`,
        );
      }
      return full.data;
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengambil data untuk export.'));
      return null;
    }
  }

  async function handleExport(): Promise<void> {
    const all = await fetchAllForExport();
    if (all) requestExport(all, EXPORT_COLUMNS, 'daftar-unit-barang', PDF_META, SERIAL_GRANULARITY);
  }

  async function handlePrint(): Promise<void> {
    printRowsToPdf(rows, EXPORT_COLUMNS, {
      ...PDF_META,
      subtitle: `${PDF_META.subtitle} — Halaman ${page}/${totalPages} (${rows.length} dari ${listResult?.total ?? rows.length} unit)`,
      generatedBy: user?.fullName,
    });
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
    };
    await actions[action]?.();
  }

  const columns: DataTableColumn<BarangSerialUnit>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: BarangSerialUnit) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<BarangSerialUnit>,
        ]
      : []),
    { key: 'sn', header: 'Nomor Seri', render: (row) => <span className="font-mono text-xs">{row.serialNumber}</span> },
    { key: 'barang', header: 'Barang', render: (row) => row.barangNama ?? `#${row.barangId}` },
    { key: 'merek', header: 'Merek', render: (row) => row.barangMerek ?? '-' },
    { key: 'tipe', header: 'Tipe', render: (row) => row.barangTipe ?? '-' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = BARANG_SERIAL_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    { key: 'gudang', header: 'Gudang', render: (row) => row.warehouseName ?? '-' },
    { key: 'updated', header: 'Diperbarui', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'riwayat',
      header: '',
      align: 'right' as const,
      render: (row) => (
        <button
          type="button"
          onClick={() => openRiwayat(row)}
          disabled={isLoadingRiwayat}
          title="Lihat Riwayat"
          className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText disabled:opacity-50"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      ),
    },
    ...(isStaff
      ? [
          {
            key: 'row-actions',
            header: '',
            align: 'right' as const,
            render: (row: BarangSerialUnit) => (
              <div className="flex items-center justify-end gap-2">
                {row.status !== 'tersedia' ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(row, 'tersedia')}
                    title="Tandai Tersedia"
                    className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {row.status !== 'rusak' ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(row, 'rusak')}
                    title="Tandai Rusak"
                    className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEditModal(row)}
                  title="Ubah"
                  className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  title="Hapus"
                  className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          } satisfies DataTableColumn<BarangSerialUnit>,
        ]
      : []),
  ];

  return (
    <PageShell title="Unit Barang (Nomor Seri)" breadcrumb="Pengelolaan / Unit Barang (Nomor Seri)">
      <StatsRow
        stats={[
          { id: 'tersedia', label: 'Tersedia', value: ringkasanTersedia?.total ?? 0 },
          { id: 'terpasang', label: 'Terpasang', value: ringkasanTerpasang?.total ?? 0 },
          { id: 'rusak', label: 'Rusak', value: ringkasanRusak?.total ?? 0 },
        ]}
      />

      <DataTable
        title="Daftar Unit"
        description={
          isBulkMode
            ? `Mode Modify aktif (${selectedIds.size} dipilih). Pilih unit per baris lalu gunakan Change/Delete di atas.`
            : 'Cari lewat nomor seri, atau saring per barang/gudang/status di bawah.'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        searchPlaceholder="Cari nomor seri......"
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        visibleActions={['add', 'export', 'print', 'modify', 'change', 'delete']}
        module="kelola_barang"
        serverPagination={{
          page,
          totalPages,
          onPageChange: setPage,
          limit,
          limitOptions: [...PAGE_LIMIT_OPTIONS],
          onLimitChange: setLimit,
          total: listResult?.total,
        }}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nomor seri......"
              aria-label="Cari nomor seri"
              className="rounded-full border border-borderSoft bg-surfaceAlt px-4 py-2 text-sm outline-none focus:border-accent"
            />
            <Select
              value={barangId}
              onChange={(e) => setBarangId(e.target.value)}
              placeholder="Filter SKU"
              options={serializedItems.map((b) => ({ label: b.sku, value: b.id }))}
              className="w-40"
            />
            <Select
              value={barangId}
              onChange={(e) => setBarangId(e.target.value)}
              placeholder="Filter Nama Barang"
              options={serializedItems.map((b) => ({ label: b.name, value: b.id }))}
              className="w-48"
            />
            <Select
              value={gudangId}
              onChange={(e) => setGudangId(e.target.value)}
              placeholder="Semua Gudang"
              options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
              className="w-44"
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Semua Status"
              options={[
                { label: 'Tersedia', value: 'tersedia' },
                { label: 'Terpasang', value: 'terpasang' },
                { label: 'Rusak', value: 'rusak' },
              ]}
              className="w-36"
            />
          </div>
        }
      />

      <Modal
        isOpen={isCreateModalOpen}
        title="Tambah Unit (Digitalisasi Stok Fisik)"
        onClose={() => setIsCreateModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateUnit} loading={isCreating}>
              Daftarkan Unit
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Barang"
            value={createBarangId}
            onChange={(e) => setCreateBarangId(e.target.value)}
            placeholder="Pilih barang ber-SN"
            options={serializedItems.map((b) => ({ label: `${b.sku} — ${b.name}`, value: b.id }))}
          />
          <Select
            label="Gudang"
            value={createGudangId}
            onChange={(e) => setCreateGudangId(e.target.value)}
            placeholder="Pilih gudang lokasi unit"
            options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Nomor Seri"
                placeholder="Ketik/scan Serial Number fisik"
                value={createSerial}
                onChange={(e) => setCreateSerial(e.target.value)}
              />
            </div>
            <ScanSnButton onScan={setCreateSerial} />
          </div>
          <Input
            label="Catatan (opsional)"
            value={createCatatan}
            onChange={(e) => setCreateCatatan(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        title={`Ubah Unit — ${editingUnit?.serialNumber ?? ''}`}
        onClose={() => setIsEditModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit} loading={isSavingEdit}>
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Gudang"
            value={editGudangId}
            onChange={(e) => setEditGudangId(e.target.value)}
            placeholder="Pilih gudang lokasi unit"
            options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
          <Input
            label="Catatan (opsional)"
            value={editCatatan}
            onChange={(e) => setEditCatatan(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={riwayatUnit !== null}
        title={`Riwayat Unit — ${riwayatUnit?.serialNumber ?? ''}`}
        onClose={() => setRiwayatUnit(null)}
        footer={
          <Button variant="secondary" onClick={() => setRiwayatUnit(null)}>
            Tutup
          </Button>
        }
      >
        {riwayatUnit ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Barang</span>
              <span className="font-medium text-text">{riwayatUnit.barangNama ?? `#${riwayatUnit.barangId}`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Status saat ini</span>
              <Badge
                label={BARANG_SERIAL_STATUS_META[riwayatUnit.status].label}
                variant={BARANG_SERIAL_STATUS_META[riwayatUnit.status].variant}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Lokasi saat ini</span>
              <span className="font-medium text-text">
                {riwayatUnit.warehouseName ?? '-'}
              </span>
            </div>
            <hr className="border-borderSoft" />
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Masuk lewat dokumen</span>
              <span className="font-mono text-xs text-text">
                {riwayatUnit.nomorBarangMasuk || 'Didaftarkan manual (bukan dari Barang Masuk)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Keluar lewat dokumen</span>
              <span className="font-mono text-xs text-text">
                {riwayatUnit.nomorBarangKeluar || 'Belum pernah keluar'}
              </span>
            </div>
            {riwayatUnit.catatan ? (
              <div className="flex flex-col gap-1">
                <span className="text-textMuted">Catatan</span>
                <span className="text-text">{riwayatUnit.catatan}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-textMuted">
              <span>Terakhir diperbarui</span>
              <span>{formatDate(riwayatUnit.updatedAt)}</span>
            </div>
          </div>
        ) : null}
      </Modal>
      {exportDialog}
    </PageShell>
  );
}