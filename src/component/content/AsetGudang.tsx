'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Pencil, Trash2, MapPin } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { assetsApi, warehousesApi, itemsApi, type AssetPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { ASSET_STATUS_META, JENIS_ASET_META } from '@/lib/utils/status';
import type { Asset, AssetStatus, JenisAset } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const JENIS_OPTIONS: { label: string; value: JenisAset }[] = [
  { label: 'Tiang', value: 'tiang' },
  { label: 'ODC', value: 'odc' },
  { label: 'ONT', value: 'ont' },
  { label: 'ODP', value: 'odp' },
  { label: 'OLT', value: 'olt' },
  { label: 'Transportasi', value: 'transportasi' },
];

const STATUS_OPTIONS: { label: string; value: AssetStatus }[] = [
  { label: 'Aktif', value: 'aktif' },
  { label: 'Rusak', value: 'rusak' },
  { label: 'Nonaktif', value: 'nonaktif' },
];

const EMPTY_FORM: Partial<AssetPayload> = { jenisAset: 'tiang', keterangan: '' };

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus aset ini? Label/kode aset ini tidak bisa dipakai ulang.';

function punyaKoordinat(jenis?: JenisAset): boolean {
  return jenis !== undefined && jenis !== 'transportasi';
}

function punyaPort(jenis?: JenisAset): boolean {
  return jenis === 'odc' || jenis === 'odp' || jenis === 'olt';
}

function AsetGudangBody(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canManage = isStaff || can('aset_gudang', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('aset-gudang', assetsApi);
  const { rows: warehouses } = useResourceList('aset-gudang-warehouses', warehousesApi);
  const { data: barangListRes } = useSWR('items-for-aset-gudang', () => itemsApi.list({ pageSize: 500 }));
  const barangOptions = (barangListRes?.data ?? []).map((b) => {
    const detail = [b.merek, b.tipe].filter(Boolean).join(' ');
    const label = `${b.sku} — ${b.name}` + (detail ? ` (${detail})` : '');
    return { label, value: b.id };
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AssetPayload>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const summary = useMemo(() => {
    const acc = { tiang: 0, odc: 0, ont: 0, odp: 0, olt: 0, transportasi: 0 };
    rows.forEach((r) => {
      acc[r.jenisAset] += 1;
    });
    return acc;
  }, [rows]);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Asset): void {
    setEditingId(row.id);
    setForm({
      nama: row.nama,
      jenisAset: row.jenisAset,
      gudangId: Number(row.gudangId),
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      keterangan: row.keterangan ?? '',
      merek: row.merek ?? '',
      tipe: row.tipe ?? '',
      parentAssetId: row.parentAssetId ? Number(row.parentAssetId) : null,
      jumlahPort: row.jumlahPort ?? 0,
      barangId: row.barangId ? Number(row.barangId) : null,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.nama || !form.jenisAset || !form.gudangId) {
      toast.error('Nama, jenis aset, dan gudang wajib diisi.');
      return;
    }
    if (punyaKoordinat(form.jenisAset) && (form.latitude === undefined || form.latitude === null || form.longitude === undefined || form.longitude === null)) {
      toast.error('Latitude dan longitude wajib diisi untuk jenis aset ini (dipakai tracking titik lokasi).');
      return;
    }
    setIsSaving(true);
    try {
      const payload: AssetPayload = {
        nama: form.nama,
        jenisAset: form.jenisAset,
        gudangId: form.gudangId,
        latitude: punyaKoordinat(form.jenisAset) ? form.latitude ?? null : null,
        longitude: punyaKoordinat(form.jenisAset) ? form.longitude ?? null : null,
        keterangan: form.keterangan ?? '',
        merek: form.merek?.trim() || undefined,
        tipe: form.tipe?.trim() || undefined,
        parentAssetId: punyaKoordinat(form.jenisAset) ? form.parentAssetId ?? null : null,
        jumlahPort: punyaPort(form.jenisAset) ? form.jumlahPort ?? 0 : 0,
        barangId: form.barangId ?? null,
      };
      if (editingId) {
        await assetsApi.update(editingId, payload);
        toast.success('Aset berhasil diperbarui.');
      } else {
        await assetsApi.create(payload);
        toast.success('Aset baru berhasil ditambahkan, label dibuat otomatis.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan aset.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: Asset): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Aset',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await assetsApi.remove(row.id);
      toast.success('Aset berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus aset.'));
    }
  }

  async function handleSetStatus(row: Asset, status: AssetStatus): Promise<void> {
    try {
      await assetsApi.setStatus(row.id, status);
      toast.success('Status aset berhasil diperbarui.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memperbarui status aset.'));
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

  const ASET_EXPORT_COLUMNS = [
    { header: 'Jenis', accessor: (r: Asset) => JENIS_ASET_META[r.jenisAset]?.label ?? r.jenisAset },
    { header: 'Label/Kode', accessor: (r: Asset) => r.labelRsd ?? r.kodeBa ?? '-' },
    { header: 'Nama', accessor: (r: Asset) => r.nama },
    { header: 'Gudang', accessor: (r: Asset) => r.gudangNama },
    { header: 'Merek', accessor: (r: Asset) => r.merek || '-' },
    { header: 'Tipe', accessor: (r: Asset) => r.tipe || '-' },
    { header: 'Kode Barang (SKU)', accessor: (r: Asset) => r.kodeBarang || '-' },
    { header: 'Latitude', accessor: (r: Asset) => (r.latitude !== null && r.latitude !== undefined ? String(r.latitude) : '-') },
    { header: 'Longitude', accessor: (r: Asset) => (r.longitude !== null && r.longitude !== undefined ? String(r.longitude) : '-') },
    { header: 'Status', accessor: (r: Asset) => r.status },
  ];
  const ASET_PDF_META = {
    title: 'Rekap Data Gudang — Manajemen Aset',
    subtitle: 'Menu Utama / Manajemen Aset Gudang',
    description: 'Daftar seluruh aset gudang (tiang, ODC, ONT, ODP, OLT, transportasi) beserta label RSD/kode BA dan titik lokasinya.',
  };

  function handleExport(): void {
    requestExport(rows, ASET_EXPORT_COLUMNS, 'daftar-aset-gudang', ASET_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, ASET_EXPORT_COLUMNS, { ...ASET_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkDelete(selectedRows: Asset[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Aset Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => assetsApi.remove(r.id)));
      toast.success(`${selectedRows.length} aset berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus.'));
    }
  }

  async function handleBulkChange(selectedRows: Asset[]): Promise<void> {
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

  const columns: DataTableColumn<Asset>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Asset) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Asset>,
        ]
      : []),
    {
      key: 'jenis',
      header: 'Jenis',
      render: (row) => {
        const meta = JENIS_ASET_META[row.jenisAset];
        return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.jenisAset;
      },
    },
    {
      key: 'label',
      header: 'Label / Kode',
      render: (row) => <span className="font-mono text-xs">{row.labelRsd ?? row.kodeBa ?? '-'}</span>,
    },
    { key: 'nama', header: 'Nama', render: (row) => row.nama },
    { key: 'merek', header: 'Merek', render: (row) => row.merek || '-' },
    { key: 'tipe', header: 'Tipe', render: (row) => row.tipe || '-' },
    { key: 'kode-barang', header: 'Kode Barang (SKU)', render: (row) => <span className="font-mono text-xs">{row.kodeBarang || '-'}</span> },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudangNama },
    {
      key: 'koordinat',
      header: 'Koordinat',
      render: (row) =>
        row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined ? (
          <span className="inline-flex items-center gap-1 text-xs text-textMuted">
            <MapPin className="h-3 w-3" /> {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = ASSET_STATUS_META[row.status];
        if (!canManage) return <Badge label={meta.label} variant={meta.variant} />;
        return (
          <select
            value={row.status}
            onChange={(e) => handleSetStatus(row, e.target.value as AssetStatus)}
            className="rounded-md border border-borderSoft bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
            onClick={() => openEditModal(row)}
            title="Edit"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
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
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Manajemen Aset Gudang" breadcrumb="Manajemen / Manajemen Aset Gudang">
      <StatsRow
        stats={[
          { id: 'tiang', label: 'Tiang', value: summary.tiang },
          { id: 'odc', label: 'ODC', value: summary.odc },
          { id: 'ont', label: 'ONT', value: summary.ont },
          { id: 'odp', label: 'ODP', value: summary.odp },
          { id: 'olt', label: 'OLT', value: summary.olt },
          { id: 'transportasi', label: 'Transportasi', value: summary.transportasi },
        ]}
      />
      <DataTable
        title="Daftar Aset Gudang"
        description={
          isBulkMode
            ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete di atas.`
            : 'Tiang, ODC, ONT, ODP, OLT, dan transportasi — label RSD/kode BA dibuat otomatis oleh sistem'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="aset_gudang"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Aset' : 'Tambah Aset'}
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
          label="Nama Aset"
          value={form.nama ?? ''}
          onChange={(event) => setForm({ ...form, nama: event.target.value })}
          placeholder="mis. Tiang Jl. Merdeka No. 12"
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Select
              label="Jenis Aset"
              value={form.jenisAset ?? 'tiang'}
              onChange={(event) => setForm({ ...form, jenisAset: event.target.value as JenisAset })}
              options={JENIS_OPTIONS}
              disabled={Boolean(editingId)}
            />
            {editingId ? (
              <p className="mt-1 text-xs text-textMuted">
                Tidak bisa diubah setelah dibuat (menentukan skema label & hierarki jaringan). Kalau
                salah input, hapus lalu buat ulang.
              </p>
            ) : null}
          </div>
          <Select
            label="Gudang"
            value={form.gudangId ? String(form.gudangId) : ''}
            onChange={(event) => setForm({ ...form, gudangId: Number(event.target.value) })}
            options={warehouses.map((w) => {
              const kodeSuffix = w.code && w.code !== '-' ? ` (${w.code})` : '';
              return { label: `${w.name}${kodeSuffix}`, value: String(w.id) };
            })}
            placeholder="Pilih gudang"
          />
        </div>
        {editingId && punyaKoordinat(form.jenisAset) ? (
          <p className="-mt-2 text-xs text-textMuted">
            Memindahkan aset ke gudang lain akan membuat ulang label RSD-nya mengikuti kode gudang tujuan.
          </p>
        ) : null}
        {punyaKoordinat(form.jenisAset) ? (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={form.latitude ?? ''}
              onChange={(event) => setForm({ ...form, latitude: event.target.value === '' ? null : Number(event.target.value) })}
              placeholder="-6.921570"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={form.longitude ?? ''}
              onChange={(event) => setForm({ ...form, longitude: event.target.value === '' ? null : Number(event.target.value) })}
              placeholder="107.607098"
            />
          </div>
        ) : (
          <p className="text-xs text-textMuted">
            Transportasi tidak punya titik koordinat tetap — diberi kode BA (Barang Aset), bukan label RSD.
          </p>
        )}
        {punyaKoordinat(form.jenisAset) ? (
          <Select
            label="Induk Jaringan (opsional)"
            value={form.parentAssetId != null ? String(form.parentAssetId) : ''}
            onChange={(event) =>
              setForm({ ...form, parentAssetId: event.target.value === '' ? null : Number(event.target.value) })
            }
            options={rows
              .filter((r) => r.id !== editingId && punyaKoordinat(r.jenisAset))
              .map((r) => ({
                value: r.id,
                label: `${JENIS_ASET_META[r.jenisAset]?.label ?? r.jenisAset} — ${r.labelRsd ?? r.nama}`,
              }))}
            placeholder="Tidak ada (titik teratas hierarki)"
          />
        ) : null}
        {punyaPort(form.jenisAset) ? (
          <Input
            label="Jumlah Port"
            type="number"
            min={0}
            max={512}
            value={form.jumlahPort ?? 0}
            onChange={(event) => setForm({ ...form, jumlahPort: Number(event.target.value) })}
            placeholder="mis. 8 — jumlah slot port fisik perangkat ini"
          />
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Merek (opsional)"
            value={form.merek ?? ''}
            onChange={(event) => setForm({ ...form, merek: event.target.value })}
            placeholder="mis. Huawei"
          />
          <Input
            label="Tipe (opsional)"
            value={form.tipe ?? ''}
            onChange={(event) => setForm({ ...form, tipe: event.target.value })}
            placeholder="mis. MA5800-X7"
          />
        </div>
        <Select
          label="Kode Barang / SKU asal (opsional)"
          value={form.barangId != null ? String(form.barangId) : ''}
          onChange={(event) => setForm({ ...form, barangId: event.target.value === '' ? null : Number(event.target.value) })}
          options={barangOptions}
          placeholder="Tautkan ke SKU di Kelola Barang (kalau ada)"
        />
        <Input
          label="Keterangan (opsional)"
          value={form.keterangan ?? ''}
          onChange={(event) => setForm({ ...form, keterangan: event.target.value })}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}

export function AsetGudangContent(): React.JSX.Element {
  return <AsetGudangBody />;
}
