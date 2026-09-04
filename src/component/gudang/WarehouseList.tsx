'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Pencil, Trash2, Lock, Unlock, MapPin, List } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { warehousesApi, geocodeApi } from '@/lib/api/modules';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { HttpError } from '@/lib/api/client';
import { formatNumber } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { geocodePrecisionMessage } from '@/lib/utils/geocode-toast';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { Warehouse } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false });

const EMPTY_FORM: Partial<Warehouse> = { name: '', code: '', address: '', picName: '', phone: '', capacity: 0 };

const CONFIRM_DELETE_MESSAGE = 'Apakah yakin ingin menghapus data ini?';
const CONFIRM_PROTECT_LOCK_MESSAGE =
  'Apakah Anda yakin untuk melindungi/mengunci data ini supaya tidak bisa dieksekusi (diubah atau dihapus) oleh role karyawan?';
const CONFIRM_PROTECT_UNLOCK_MESSAGE = 'Apakah Anda yakin ingin membuka kunci data ini?';

type WarehouseMapViewProps = {
  warehouses: Warehouse[];
  center: [number, number];
  icon: any;
};

function WarehouseMapView({ warehouses, center, icon }: Readonly<WarehouseMapViewProps>): React.JSX.Element {
  if (warehouses.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-textMuted">
        Belum ada gudang dengan koordinat terisi. Isi Latitude/Longitude lewat Ubah Gudang
        (bisa dicari otomatis dari alamat) supaya muncul di sini.
      </p>
    );
  }

  return (
    <MapContainer center={center} zoom={11} style={{ height: '420px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {warehouses.map((warehouse) => (
        <Marker
          key={warehouse.id}
          position={[warehouse.latitude as number, warehouse.longitude as number]}
          icon={icon ?? undefined}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <span className="font-semibold">{warehouse.name}</span>
            {warehouse.code && warehouse.code !== '-' ? ` (${warehouse.code})` : ''}
            <br />
            {warehouse.address}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

export function WarehouseListContent(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, error, mutate, serverPagination } = useServerPaginatedList(
    'warehouses',
    warehousesApi,
    { search: searchTerm || undefined },

    { initialLimit: 200 },
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Warehouse>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'data' | 'peta'>('data');

  const [warehouseIcon, setWarehouseIcon] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((L) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#b45309;color:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21V10l9-6 9 6v11" /><path d="M3 10h18" /><rect x="7" y="14" width="4" height="7" /><rect x="13" y="14" width="4" height="4" />
          </svg>
        </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });

      setWarehouseIcon(icon);
    });
  }, []);
  const [isGeocoding, setIsGeocoding] = useState(false);

  async function handleGeocodeAddress(): Promise<void> {
    const original = form.address?.trim();
    if (!original) return;
    setIsGeocoding(true);
    // Timeout sisi klien: backend sekarang mencoba beberapa strategi
    // query secara berurutan (bisa beberapa detik), tapi tetap dibatasi
    // supaya tombol "Mencari..." tidak terkunci selamanya kalau ada
    // masalah jaringan/infra.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      // Pencarian koordinat sekarang lewat backend (bukan langsung ke
      // Nominatim dari browser) — backend yang membersihkan notasi RT/RW,
      // mencoba query terstruktur + bertahap, dan melaporkan presisi hasil
      // dengan jujur. Lihat pkg/geocoding di backend untuk detailnya.
      const result = await geocodeApi.search(original, controller.signal);
      setForm((prev) => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
      toast.success(geocodePrecisionMessage(result.precision, result.displayName));
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

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalCapacity = rows.reduce((sum, wh) => sum + wh.capacity, 0);
  const totalUsed = rows.reduce((sum, wh) => sum + wh.usedCapacity, 0);
  const totalItems = rows.reduce((sum, wh) => sum + wh.totalItems, 0);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Warehouse): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code ?? '',
      address: row.address,
      picName: row.picName,
      phone: row.phone ?? '',
      capacity: row.capacity,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {

    if (!form.name?.trim()) {
      toast.error('Nama gudang wajib diisi.');
      return;
    }
    if (!form.code?.trim()) {
      toast.error('Kode gudang wajib diisi (mis. BBU, BDG1).');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await warehousesApi.update(editingId, form);
        toast.success('Gudang berhasil diperbarui.');
      } else {
        await warehousesApi.create(form);
        toast.success('Gudang baru berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan gudang.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOne(row: Warehouse): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Gudang',
      message: CONFIRM_DELETE_MESSAGE,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await warehousesApi.remove(row.id);
      toast.success('Gudang berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus gudang.'));
    }
  }

  async function handleToggleProtect(row: Warehouse): Promise<void> {
    const willProtect = !row.isProtected;
    const ok = await confirm({
      title: willProtect ? 'Kunci Data Ini?' : 'Buka Kunci Data Ini?',
      message: willProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: willProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await warehousesApi.setProtected(row.id, willProtect);
      toast.success(willProtect ? 'Data dikunci (Protect).' : 'Data dibuka kuncinya.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
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

  const WAREHOUSE_EXPORT_COLUMNS = [
    { header: 'Nama Gudang', accessor: (r: Warehouse) => r.name },
    { header: 'Kode', accessor: (r: Warehouse) => r.code },
    { header: 'Alamat / Koordinat', accessor: (r: Warehouse) => r.address },
    { header: 'PIC', accessor: (r: Warehouse) => r.picName },
    { header: 'Kapasitas Terpakai', accessor: (r: Warehouse) => r.usedCapacity },
    { header: 'Total Kapasitas', accessor: (r: Warehouse) => r.capacity },
    { header: 'Status', accessor: (r: Warehouse) => r.status },
  ];
  const WAREHOUSE_PDF_META = {
    title: 'Rekap Data Daftar Gudang',
    subtitle: 'Manajemen / Manajemen Gudang',
    description: 'Kumpulan data gudang yang ditentukan.',
  };

  function handleExport(): void {
    requestExport(rows, WAREHOUSE_EXPORT_COLUMNS, 'daftar-gudang', WAREHOUSE_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, WAREHOUSE_EXPORT_COLUMNS, { ...WAREHOUSE_PDF_META, generatedBy: user?.fullName });
  }

  async function handleBulkChange(selectedRows: Warehouse[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" terlebih dahulu untuk memilih data per baris yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU baris data untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: Warehouse[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" terlebih dahulu, kemudian pilih satu atau beberapa data per baris yang mau dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Gudang Terpilih',
      message: `${CONFIRM_DELETE_MESSAGE} (${selectedRows.length} baris terpilih)`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => warehousesApi.remove(r.id)));
      toast.success(`${selectedRows.length} gudang berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua data gagal dihapus (mungkin ada yang di-Protect).'));
    }
  }

  async function handleBulkProtect(selectedRows: Warehouse[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih baris yang mau dikunci/dibuka.');
      return;
    }
    const shouldProtect = !selectedRows[0].isProtected;
    const ok = await confirm({
      title: shouldProtect ? 'Kunci Data Terpilih?' : 'Buka Kunci Data Terpilih?',
      message: shouldProtect ? CONFIRM_PROTECT_LOCK_MESSAGE : CONFIRM_PROTECT_UNLOCK_MESSAGE,
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => warehousesApi.setProtected(r.id, shouldProtect)));
      toast.success(shouldProtect ? 'Data terpilih dikunci.' : 'Data terpilih dibuka kuncinya.');
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    const actionHandlers: Partial<Record<TableRowAction, () => Promise<void> | void>> = {
      add: () => openCreateModal(),
      export: () => handleExport(),
      print: () => handlePrint(),
      modify: () => {
        setIsBulkMode((prev) => !prev);
        setSelectedIds(new Set());
      },
      change: async () => {
        await handleBulkChange(selectedRows);
      },
      delete: async () => {
        await handleBulkDelete(selectedRows);
      },
      protect: async () => {
        await handleBulkProtect(selectedRows);
      },
    };

    const handler = actionHandlers[action];
    if (handler) {
      await handler();
    }
  }

  const columns: DataTableColumn<Warehouse>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Warehouse) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Warehouse>,
        ]
      : []),
    { key: 'name', header: 'Nama Gudang', render: (row) => row.name },
    { key: 'code', header: 'Kode', render: (row) => row.code },
    {
      key: 'address',
      header: 'Alamat',
      render: (row) => (row.isProtected && !isStaff ? '••••••' : row.address),
    },
    { key: 'pic', header: 'PIC', render: (row) => row.picName },
    {
      key: 'capacity',
      header: 'Kapasitas',
      align: 'right',
      render: (row) => `${formatNumber(row.usedCapacity)} / ${formatNumber(row.capacity)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status];
        return (
          <div className="flex items-center gap-1.5">
            {meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status}
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

  const warehousesWithCoords = rows.filter((w) => w.latitude != null && w.longitude != null);
  const mapCenter: [number, number] =
    warehousesWithCoords.length > 0
      ? [
          warehousesWithCoords.reduce((sum, w) => sum + (w.latitude as number), 0) / warehousesWithCoords.length,
          warehousesWithCoords.reduce((sum, w) => sum + (w.longitude as number), 0) / warehousesWithCoords.length,
        ]
      : [-6.9175, 107.6191];

  return (
    <PageShell title="Manajemen Gudang" breadcrumb="Manajemen / Manajemen Gudang">
      <StatsRow
        stats={[
          { id: 'jumlah-gudang', label: 'Jumlah Gudang', value: serverPagination.total ?? rows.length },
          {
            id: 'kapasitas',
            label: 'Kapasitas Terpakai',
            value: `${formatNumber(totalUsed)} Unit`,
          },
          {
            id: 'total-kapasitas',
            label: 'Total Kapasitas',
            value: `${formatNumber(totalCapacity)} Unit`,
          },
          { id: 'total-barang', label: 'Total Barang', value: formatNumber(totalItems) },
        ]}
      />

      <div className="flex items-center gap-1 rounded-full bg-neutralBg p-1 text-xs w-fit">
        <button
          type="button"
          onClick={() => setViewMode('data')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors ${
            viewMode === 'data' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
          }`}
        >
          <List className="h-3.5 w-3.5" /> Kelola Data Gudang
        </button>
        <button
          type="button"
          onClick={() => setViewMode('peta')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors ${
            viewMode === 'peta' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" /> Peta
        </button>
      </div>

      {viewMode === 'peta' ? (
        <Card className="flex flex-col gap-2 overflow-hidden p-0">
          <WarehouseMapView warehouses={warehousesWithCoords} center={mapCenter} icon={warehouseIcon} />
        </Card>
      ) : (
        <DataTable
          title="Daftar Gudang"
          description={
            isBulkMode
              ? `Mode Modify aktif — ${selectedIds.size} baris terpilih. Pilih baris lalu pakai Change/Delete/Protect di atas.`
              : 'Persebaran gudang beserta kapasitas & PIC — Kapasitas Terpakai/Total Barang dihitung dari unit ber-Nomor-Seri saja'
          }
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          errorMessage={listErrorMessage(error)}
          onRowAction={handleRowAction}
          module="manajemen_gudang"
          serverPagination={serverPagination}
          toolbar={<TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nama gudang......" />}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Gudang' : 'Tambah Gudang'}
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
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nama Gudang"
            value={form.name ?? ''}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Kode Gudang"
            placeholder="mis. BBU, BDG1"
            value={form.code ?? ''}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          />
        </div>
        <Input
          label="Alamat"
          placeholder="Contoh: Jl. Manggahang No. 12, Bandung"
          value={form.address ?? ''}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
        />
        <div className="-mt-2 flex items-center justify-between">
          <p className="text-xs text-textMuted">
            Koordinat bisa disalin manual dari Google Maps, atau cari otomatis dari alamat di atas.
          </p>
          <button
            type="button"
            onClick={handleGeocodeAddress}
            disabled={isGeocoding || !form.address?.trim()}
            className="flex shrink-0 items-center gap-1 rounded-md border border-borderSoft px-2 py-1 text-xs font-semibold text-accentDark hover:border-accent disabled:opacity-50"
          >
            <MapPin className="h-3.5 w-3.5" /> {isGeocoding ? 'Mencari...' : 'Cari Koordinat dari Alamat'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Latitude"
            placeholder="-7.0209099"
            inputMode="decimal"
            value={form.latitude !== undefined ? String(form.latitude) : ''}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              setForm({ ...form, latitude: raw === '' || Number.isNaN(parsed) ? undefined : parsed });
            }}
          />
          <Input
            label="Longitude"
            placeholder="107.6495411"
            inputMode="decimal"
            value={form.longitude !== undefined ? String(form.longitude) : ''}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              setForm({ ...form, longitude: raw === '' || Number.isNaN(parsed) ? undefined : parsed });
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="PIC (Penanggung Jawab)"
            placeholder="Nama PIC gudang"
            value={form.picName ?? ''}
            onChange={(event) => setForm({ ...form, picName: event.target.value })}
          />
          <Input
            label="No. Telepon Gudang"
            placeholder="0812xxxxxxx"
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <NumberField
          label="Kapasitas Total (unit)"
          value={form.capacity ?? 0}
          onValueChange={(value) => setForm({ ...form, capacity: value })}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}
