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
import { CurrencyField, Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { assetsApi, warehousesApi, itemsApi, geocodeApi, type AssetPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { HttpError } from '@/lib/api/client';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { formatTanggalPanjang, type GranularityConfig } from '@/lib/utils/period-grouping';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { geocodePrecisionMessage } from '@/lib/utils/geocode-toast';
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

function isTransportasi(jenis?: JenisAset): boolean {
  return jenis === 'transportasi';
}

function getAssetFormValidationError(form: Partial<AssetPayload>): string | null {
  if (!form.nama || !form.jenisAset || !form.gudangId) {
    return 'Nama, jenis aset, dan gudang wajib diisi.';
  }
  if (punyaKoordinat(form.jenisAset) && (form.latitude === undefined || form.latitude === null || form.longitude === undefined || form.longitude === null)) {
    return 'Latitude dan longitude wajib diisi untuk jenis aset ini (dipakai tracking titik lokasi).';
  }
  if (isTransportasi(form.jenisAset) && (!form.nopol?.trim() || !form.jenisTransportasi?.trim() || !form.nomorBpkb?.trim() || !form.tahunKendaraan)) {
    return 'Nomor polisi, jenis transportasi, nomor BPKB, dan tahun kendaraan wajib diisi untuk aset transportasi.';
  }
  return null;
}

type AsetTab = 'infrastruktur' | 'transportasi';

const JENIS_COLUMN: DataTableColumn<Asset> = {
  key: 'jenis',
  header: 'Jenis',
  render: (row) => {
    const meta = JENIS_ASET_META[row.jenisAset];
    return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.jenisAset;
  },
};

const LABEL_COLUMN: DataTableColumn<Asset> = {
  key: 'label',
  header: 'Label / Kode',
  render: (row) => <span className="font-mono text-xs">{row.labelRsd ?? row.kodeBa ?? '-'}</span>,
};

const NAMA_COLUMN: DataTableColumn<Asset> = { key: 'nama', header: 'Nama', render: (row) => row.nama };
const MEREK_COLUMN: DataTableColumn<Asset> = { key: 'merek', header: 'Merek', render: (row) => row.merek || '-' };
const TIPE_COLUMN: DataTableColumn<Asset> = { key: 'tipe', header: 'Tipe', render: (row) => row.tipe || '-' };

const KODE_BARANG_COLUMN: DataTableColumn<Asset> = {
  key: 'kode-barang',
  header: 'Kode Barang (SKU)',
  render: (row) => <span className="font-mono text-xs">{row.kodeBarang || '-'}</span>,
};

const NILAI_ASET_COLUMN: DataTableColumn<Asset> = {
  key: 'nilai-aset',
  header: 'Nilai Aset',
  align: 'right',
  render: (row) => formatCurrency(row.nilaiAset ?? 0),
};

const GUDANG_COLUMN: DataTableColumn<Asset> = { key: 'gudang', header: 'Gudang', render: (row) => row.gudangNama };

const KOORDINAT_COLUMN: DataTableColumn<Asset> = {
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
};

const TRANSPORTASI_COLUMN: DataTableColumn<Asset> = {
  key: 'transportasi',
  header: 'Data Transportasi',
  render: (row) =>
    isTransportasi(row.jenisAset) ? (
      <span className="text-xs text-textMuted" title={`BPKB: ${row.nomorBpkb || '-'}`}>
        {row.nopol || '-'} · {row.jenisTransportasi || '-'} · {row.tahunKendaraan || '-'}
      </span>
    ) : (
      '-'
    ),
};

const CREATED_COLUMN: DataTableColumn<Asset> = { key: 'created', header: 'Tanggal Dibuat', render: (row) => formatDate(row.createdAt) };

function buildSelectColumn(selectedIds: Set<string>, toggleSelected: (id: string) => void): DataTableColumn<Asset> {
  return {
    key: 'select',
    header: '',
    render: (row) => (
      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} className="h-4 w-4" />
    ),
  };
}

function buildStatusColumn(canManage: boolean, onSetStatus: (row: Asset, status: AssetStatus) => void): DataTableColumn<Asset> {
  return {
    key: 'status',
    header: 'Status',
    render: (row) => {
      const meta = ASSET_STATUS_META[row.status];
      if (!canManage) return <Badge label={meta.label} variant={meta.variant} />;
      return (
        <select
          value={row.status}
          onChange={(e) => onSetStatus(row, e.target.value as AssetStatus)}
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
  };
}

function buildRowActionsColumn(isStaff: boolean, onEdit: (row: Asset) => void, onDelete: (row: Asset) => void): DataTableColumn<Asset> {
  return {
    key: 'row-actions',
    header: '',
    align: 'right',
    render: (row) => (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(row)}
          title="Edit"
          className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {isStaff ? (
          <button
            type="button"
            onClick={() => onDelete(row)}
            title="Hapus"
            className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    ),
  };
}

interface AsetColumnParams {
  isBulkMode: boolean;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  canManage: boolean;
  onSetStatus: (row: Asset, status: AssetStatus) => void;
  isStaff: boolean;
  onEdit: (row: Asset) => void;
  onDelete: (row: Asset) => void;
}

/**
 * Susun kolom DataTable sesuai tab aktif — Infrastruktur (Tiang/ODC/ONT/ODP/OLT,
 * dengan SKU & koordinat) vs Transportasi (dengan Data Transportasi, tanpa
 * SKU/koordinat yang memang tidak relevan untuk kendaraan).
 */
function getColumnsForTab(tab: AsetTab, params: AsetColumnParams): DataTableColumn<Asset>[] {
  const selectColumn = params.isBulkMode ? [buildSelectColumn(params.selectedIds, params.toggleSelected)] : [];
  const middleColumns =
    tab === 'infrastruktur'
      ? [KODE_BARANG_COLUMN, NILAI_ASET_COLUMN, GUDANG_COLUMN, KOORDINAT_COLUMN]
      : [NILAI_ASET_COLUMN, GUDANG_COLUMN, TRANSPORTASI_COLUMN];
  const statusColumn = buildStatusColumn(params.canManage, params.onSetStatus);
  const rowActionsColumn = buildRowActionsColumn(params.isStaff, params.onEdit, params.onDelete);
  return [...selectColumn, JENIS_COLUMN, LABEL_COLUMN, NAMA_COLUMN, MEREK_COLUMN, TIPE_COLUMN, ...middleColumns, statusColumn, CREATED_COLUMN, rowActionsColumn];
}

function filterRowsByTab(rows: Asset[], tab: AsetTab): Asset[] {
  return rows.filter((r) => (tab === 'infrastruktur' ? !isTransportasi(r.jenisAset) : isTransportasi(r.jenisAset)));
}

interface TableMeta {
  title: string;
  description: string;
}

function getTableMeta(tab: AsetTab, isBulkMode: boolean, selectedCount: number): TableMeta {
  const title = tab === 'infrastruktur' ? 'Daftar Aset Infrastruktur' : 'Daftar Aset Transportasi';
  if (isBulkMode) {
    return { title, description: `Mode Modify aktif — ${selectedCount} baris terpilih. Pilih baris lalu pakai Change/Delete di atas.` };
  }
  const description =
    tab === 'infrastruktur'
      ? 'Tiang, ODC, ONT, ODP, OLT — label RSD dibuat otomatis oleh sistem'
      : 'Kendaraan operasional — kode BA (Barang Aset) dibuat otomatis oleh sistem';
  return { title, description };
}

function AsetTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'border-accent text-accentDark' : 'border-transparent text-textMuted hover:text-text'
      }`}
    >
      {label}
    </button>
  );
}

function AsetTabBar({ activeTab, onChange }: { activeTab: AsetTab; onChange: (tab: AsetTab) => void }): React.JSX.Element {
  return (
    <div className="flex gap-2 border-b border-borderSoft">
      <AsetTabButton label="Infrastruktur" active={activeTab === 'infrastruktur'} onClick={() => onChange('infrastruktur')} />
      <AsetTabButton label="Transportasi" active={activeTab === 'transportasi'} onClick={() => onChange('transportasi')} />
    </div>
  );
}

function AsetGudangBody(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canManage = isStaff || can('aset_gudang', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [filterMerek, setFilterMerek] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, error, mutate } = useResourceList('aset-gudang', assetsApi, {
    // pageSize 500: sebelumnya panggilan ini tidak mengirim param apa pun
    // sehingga backend memakai default limit=10 — daftar aset di halaman
    // ini diam-diam terpotong cuma 10 baris pertama. Dengan filter/pencarian
    // baru di sini, itu jadi sangat kentara (filter kelihatan "tidak ada
    // hasil" padahal datanya ada di luar 10 baris pertama), jadi sekalian
    // diperbaiki di sini.
    pageSize: 500,
    search: searchTerm || undefined,
    merek: filterMerek || undefined,
    tipe: filterTipe || undefined,
  });
  const { rows: warehouses } = useResourceList('aset-gudang-warehouses', warehousesApi);
  // Daftar tak terfilter, khusus buat membangun opsi dropdown Merek/Tipe —
  // supaya pilihan di dropdown tidak ikut menyempit/hilang begitu salah
  // satu filter (merek/tipe/search) sedang aktif (lihat `rows` di atas yang
  // memang sengaja sudah terfilter dari server).
  const { rows: allAssetsForFilters } = useResourceList('aset-gudang-all-for-filters', assetsApi, { pageSize: 500 });
  const merekOptions = Array.from(new Set(allAssetsForFilters.map((r) => r.merek).filter(Boolean))) as string[];
  const tipeOptions = Array.from(new Set(allAssetsForFilters.map((r) => r.tipe).filter(Boolean))) as string[];
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Aset tidak punya alamat sendiri — lokasinya "menempel" ke gudang yang
  // dipilih. Jadi cek koordinat otomatis di sini memakai alamat gudang
  // tersebut (sama seperti "Cari Koordinat dari Alamat" di menu Manajemen
  // Gudang), lewat endpoint geocoding di backend, bukan alamat baru yang
  // diketik ulang.
  async function handleGeocodeFromGudang(): Promise<void> {
    const selectedGudang = warehouses.find((w) => w.id === String(form.gudangId));
    const original = selectedGudang?.address?.trim();
    if (!original) {
      toast.error('Gudang ini belum punya alamat tersimpan — isi koordinat manual, atau lengkapi alamat gudangnya dulu di menu Manajemen Gudang.');
      return;
    }
    setIsGeocoding(true);
    // AbortController + timeout: tanpa ini, kalau ada masalah
    // jaringan/infra, fetch() bisa menggantung selamanya dan isGeocoding
    // tidak pernah kembali ke false (tombol "Mencari..." terkunci terus)
    // karena finally di bawah baru jalan setelah fetch benar-benar
    // selesai/gagal.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      // Pencarian koordinat sekarang lewat backend (bukan langsung ke
      // Nominatim dari browser) — backend yang membersihkan notasi RT/RW,
      // mencoba query terstruktur + bertahap, dan melaporkan presisi hasil
      // dengan jujur. Lihat pkg/geocoding di backend untuk detailnya.
      const result = await geocodeApi.search(original, controller.signal);
      setForm((prev) => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
      toast.success(geocodePrecisionMessage(result.precision, `${result.displayName} (dari alamat gudang)`));
    } catch (err) {
      toast.error(
        err instanceof HttpError
          ? err.message
          : 'Gagal mencari koordinat, coba cek koneksi internet atau isi koordinat manual.',
      );
    } finally {
      clearTimeout(timeoutId);
      setIsGeocoding(false);
    }
  }
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

  const [activeTab, setActiveTab] = useState<AsetTab>('infrastruktur');

  const summary = useMemo(() => {
    const acc = { tiang: 0, odc: 0, ont: 0, odp: 0, olt: 0, transportasi: 0 };
    rows.forEach((r) => {
      acc[r.jenisAset] += 1;
    });
    return acc;
  }, [rows]);

  const filteredRows = useMemo(() => filterRowsByTab(rows, activeTab), [rows, activeTab]);

  function switchTab(tab: AsetTab): void {
    setActiveTab(tab);
    setSelectedIds(new Set());
  }

  function openCreateModal(): void {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, jenisAset: activeTab === 'transportasi' ? 'transportasi' : 'tiang' });
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
      nilaiAset: row.nilaiAset ?? 0,
      parentAssetId: row.parentAssetId ? Number(row.parentAssetId) : null,
      jumlahPort: row.jumlahPort ?? 0,
      barangId: row.barangId ? Number(row.barangId) : null,
      nopol: row.nopol ?? '',
      jenisTransportasi: row.jenisTransportasi ?? '',
      nomorBpkb: row.nomorBpkb ?? '',
      tahunKendaraan: row.tahunKendaraan ?? undefined,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    const validationError = getAssetFormValidationError(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsSaving(true);
    try {
      // Non-null assertions aman di sini — getAssetFormValidationError() di
      // atas sudah memastikan ketiganya terisi sebelum handleSave lanjut.
      const payload: AssetPayload = {
        nama: form.nama!,
        jenisAset: form.jenisAset!,
        gudangId: form.gudangId!,
        latitude: punyaKoordinat(form.jenisAset) ? form.latitude ?? null : null,
        longitude: punyaKoordinat(form.jenisAset) ? form.longitude ?? null : null,
        keterangan: form.keterangan ?? '',
        merek: form.merek?.trim() || undefined,
        tipe: form.tipe?.trim() || undefined,
        nilaiAset: form.nilaiAset ?? 0,
        parentAssetId: punyaKoordinat(form.jenisAset) ? form.parentAssetId ?? null : null,
        jumlahPort: punyaPort(form.jenisAset) ? form.jumlahPort ?? 0 : 0,
        barangId: form.barangId ?? null,
        nopol: isTransportasi(form.jenisAset) ? form.nopol?.trim() || undefined : undefined,
        jenisTransportasi: isTransportasi(form.jenisAset) ? form.jenisTransportasi?.trim() || undefined : undefined,
        nomorBpkb: isTransportasi(form.jenisAset) ? form.nomorBpkb?.trim() || undefined : undefined,
        tahunKendaraan: isTransportasi(form.jenisAset) ? form.tahunKendaraan ?? undefined : undefined,
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
    { header: 'Nilai Aset', accessor: (r: Asset) => r.nilaiAset ?? 0 },
    { header: 'Latitude', accessor: (r: Asset) => (r.latitude !== null && r.latitude !== undefined ? String(r.latitude) : '-') },
    { header: 'Longitude', accessor: (r: Asset) => (r.longitude !== null && r.longitude !== undefined ? String(r.longitude) : '-') },
    { header: 'Nomor Polisi', accessor: (r: Asset) => r.nopol || '-' },
    { header: 'Jenis Transportasi', accessor: (r: Asset) => r.jenisTransportasi || '-' },
    { header: 'Nomor BPKB', accessor: (r: Asset) => r.nomorBpkb || '-' },
    { header: 'Tahun Kendaraan', accessor: (r: Asset) => r.tahunKendaraan || '-' },
    { header: 'Status', accessor: (r: Asset) => r.status },
    { header: 'Tanggal Dibuat', accessor: (r: Asset) => formatTanggalPanjang(r.createdAt) },
  ];
  const ASET_GRANULARITY: GranularityConfig<Asset> = {
    dateAccessor: (r) => r.createdAt,
    sumHeaders: ['Nilai Aset'],
    groupKeyHeader: 'Jenis',
  };
  const ASET_PDF_META = {
    title: 'Rekap Data Gudang — Manajemen Aset',
    subtitle: 'Menu Utama / Manajemen Aset Gudang',
    description: 'Daftar seluruh aset gudang (tiang, ODC, ONT, ODP, OLT, transportasi) beserta label RSD/kode BA dan titik lokasinya.',
  };

  function handleExport(): void {
    requestExport(rows, ASET_EXPORT_COLUMNS, 'daftar-aset-gudang', ASET_PDF_META, ASET_GRANULARITY);
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
    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));
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

  const columns = useMemo(
    () =>
      getColumnsForTab(activeTab, {
        isBulkMode,
        selectedIds,
        toggleSelected,
        canManage,
        onSetStatus: handleSetStatus,
        isStaff,
        onEdit: openEditModal,
        onDelete: handleDeleteOne,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identitas berubah tiap render (bukan useCallback), tapi definisinya stabil secara semantik
    [activeTab, isBulkMode, selectedIds, canManage, isStaff],
  );

  const { title: tableTitle, description: tableDescription } = getTableMeta(activeTab, isBulkMode, selectedIds.size);

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
      <AsetTabBar activeTab={activeTab} onChange={switchTab} />
      <DataTable
        title={tableTitle}
        description={tableDescription}
        columns={columns}
        rows={filteredRows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="aset_gudang"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
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
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nama aset......" />
          </div>
        }
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
              onChange={(event) => {
                const nextJenis = event.target.value as JenisAset;
                setForm({ ...form, jenisAset: nextJenis, barangId: isTransportasi(nextJenis) ? null : form.barangId });
              }}
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
          <div className="flex flex-col gap-2">
          <div className="-mb-1 flex items-center justify-between">
            <p className="text-xs text-textMuted">
              Koordinat bisa disalin manual dari Google Maps, atau dicari otomatis dari alamat gudang yang dipilih di atas.
            </p>
            <button
              type="button"
              onClick={handleGeocodeFromGudang}
              disabled={isGeocoding || !form.gudangId}
              className="flex shrink-0 items-center gap-1 rounded-md border border-borderSoft px-2 py-1 text-xs font-semibold text-accentDark hover:border-accent disabled:opacity-50"
            >
              <MapPin className="h-3.5 w-3.5" /> {isGeocoding ? 'Mencari...' : 'Cari Koordinat dari Alamat Gudang'}
            </button>
          </div>
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
          </div>
        ) : (
          <>
            <p className="text-xs text-textMuted">
              Transportasi tidak punya titik koordinat tetap — diberi kode BA (Barang Aset), bukan label RSD.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nomor Polisi"
                value={form.nopol ?? ''}
                onChange={(event) => setForm({ ...form, nopol: event.target.value })}
                placeholder="mis. D 1234 ABC"
              />
              <Input
                label="Jenis Transportasi"
                value={form.jenisTransportasi ?? ''}
                onChange={(event) => setForm({ ...form, jenisTransportasi: event.target.value })}
                placeholder="mis. Mobil Pickup, Motor, Truk Box"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nomor BPKB"
                value={form.nomorBpkb ?? ''}
                onChange={(event) => setForm({ ...form, nomorBpkb: event.target.value })}
                placeholder="mis. J-01234567"
              />
              <Input
                label="Tahun Kendaraan"
                type="number"
                min={1950}
                max={2100}
                value={form.tahunKendaraan ?? ''}
                onChange={(event) => setForm({ ...form, tahunKendaraan: event.target.value === '' ? undefined : Number(event.target.value) })}
                placeholder="mis. 2022"
              />
            </div>
          </>
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
        <CurrencyField
          label="Nilai Aset (opsional)"
          value={form.nilaiAset ?? 0}
          onValueChange={(value) => setForm({ ...form, nilaiAset: value })}
        />
        {!isTransportasi(form.jenisAset) && (
          <Select
            label="Kode Barang / SKU asal (opsional)"
            value={form.barangId != null ? String(form.barangId) : ''}
            onChange={(event) => setForm({ ...form, barangId: event.target.value === '' ? null : Number(event.target.value) })}
            options={barangOptions}
            placeholder="Tautkan ke SKU di Kelola Barang (kalau ada)"
          />
        )}
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
