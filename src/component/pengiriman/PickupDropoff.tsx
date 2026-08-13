'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';
import { Trash2, Pencil, Printer, Lock, Truck, PlayCircle } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { DeliveriesMap } from '@/component/pengiriman/DeliveriesMap';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { deliveriesApi, warehousesApi, type DeliveryPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { printResiPengiriman } from '@/lib/utils/print-resi';
import { formatDate } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { Delivery } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<DeliveryPayload> = { jenisPengambilan: 'pickup' };
const BANDUNG_CENTER = { lat: -6.9175, lng: 107.6191 };


export function PickupDropoffContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

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

  const { rows, isLoading, error, mutate } = useResourceList('deliveries', deliveriesApi);
  const { data: gudangList } = useSWR('warehouses-for-pickup', () => warehousesApi.list({ pageSize: 100 }));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DeliveryPayload>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Delivery): void {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    setEditingId(row.id);
    setForm({
      gudangAsalId: row.originGudangId,
      jenisPengambilan: row.type,
      namaPenerima: row.receiverName ?? '',
      teleponPenerima: row.receiverPhone ?? '',
      alamatTujuan: row.destination,
      destLat: row.destLatitude ?? null,
      destLng: row.destLongitude ?? null,
      tanggalKirim: row.scheduledAt?.slice(0, 10),
      catatan: row.notes ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!editingId && (!form.gudangAsalId || !form.namaPenerima || !form.tanggalKirim)) {
      toast.error('Gudang asal, nama penerima, dan tanggal wajib diisi.');
      return;
    }
    if (editingId && (!form.namaPenerima || !form.tanggalKirim || !form.gudangAsalId)) {
      toast.error('Gudang asal, nama penerima, dan tanggal wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await deliveriesApi.update(editingId, form as DeliveryPayload);
        toast.success('Jadwal pickup/dropoff berhasil diubah.');
      } else {
        await deliveriesApi.create(form as DeliveryPayload);
        toast.success('Jadwal pickup/dropoff berhasil dibuat.');
      }
      setIsModalOpen(false);
      setEditingId(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, editingId ? 'Gagal mengubah jadwal.' : 'Gagal membuat jadwal.'));
    } finally {
      setIsSaving(false);
    }
  }

  const [jadwalkanTarget, setJadwalkanTarget] = useState<Delivery | null>(null);
  const [jadwalkanKurir, setJadwalkanKurir] = useState('');
  const [jadwalkanTelepon, setJadwalkanTelepon] = useState('');
  const [isJadwalkanSaving, setIsJadwalkanSaving] = useState(false);

  function openJadwalkanModal(row: Delivery): void {
    setJadwalkanTarget(row);
    setJadwalkanKurir(row.courierName === '-' ? '' : row.courierName);
    setJadwalkanTelepon(row.courierPhone ?? '');
  }

  async function handleJadwalkanSubmit(): Promise<void> {
    if (!jadwalkanTarget) return;
    if (!jadwalkanKurir.trim()) {
      toast.error('Nama kurir wajib diisi.');
      return;
    }
    setIsJadwalkanSaving(true);
    try {
      await deliveriesApi.jadwalkan(jadwalkanTarget.id, {
        namaKurir: jadwalkanKurir.trim(),
        teleponKurir: jadwalkanTelepon.trim() || undefined,
      });
      toast.success('Kurir berhasil ditugaskan — status jadi "Menunggu Dijemput".');
      setJadwalkanTarget(null);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menjadwalkan kurir.'));
    } finally {
      setIsJadwalkanSaving(false);
    }
  }

  // "Mulai Perjalanan": SATU-SATUNYA cara mencapai status "Dalam
  // Perjalanan" — backend HANYA menerima ping GPS kurir (POST
  // /pengiriman/:id/lokasi) selama status persis ini (lihat catatan di
  // pengiriman_controller.go KirimLokasi). Tanpa tombol ini, live
  // tracking GPS tidak akan pernah bisa diuji sama sekali karena status
  // pengiriman tidak akan pernah mencapai "Dalam Perjalanan" dari UI.
  async function handleMulai(row: Delivery): Promise<void> {
    try {
      await deliveriesApi.mulai(row.id);
      toast.success('Pengiriman dimulai — sekarang kurir bisa mengirim update lokasi GPS.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memulai pengiriman — pastikan kurir sudah ditugaskan (Jadwalkan) dulu.'));
    }
  }

  async function handleDelete(row: Delivery): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Jadwal',
      message: `Apakah yakin ingin menghapus data ini? (${row.code})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deliveriesApi.remove(row.id);
      toast.success('Jadwal berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus jadwal.'));
    }
  }

  async function handleBulkChange(selectedRows: Delivery[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu baris data yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU jadwal (status Menunggu) untuk diubah.');
      return;
    }
    if (selectedRows[0].status !== 'menunggu') {
      toast.error('Hanya jadwal berstatus Menunggu yang bisa diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: Delivery[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk dihapus.');
      return;
    }
    const protectedRows = selectedRows.filter((r) => r.isProtected);
    if (protectedRows.length > 0) {
      toast.error('Ada baris yang dikunci (Protect) — buka kuncinya dulu sebelum dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Jadwal',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} jadwal terpilih?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => deliveriesApi.remove(r.id)));
      toast.success(`${selectedRows.length} jadwal berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus sebagian/semua data terpilih.'));
    }
  }

  async function handleBulkProtect(selectedRows: Delivery[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk di-protect.');
      return;
    }
    const shouldProtect = selectedRows.some((r) => !r.isProtected);
    const ok = await confirm({
      title: shouldProtect ? 'Kunci (Protect) Data' : 'Buka Kunci Data',
      message: `${shouldProtect ? 'Kunci' : 'Buka kunci'} ${selectedRows.length} jadwal terpilih dari perubahan/penghapusan?`,
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka Kunci',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => deliveriesApi.setProtected(r.id, shouldProtect)));
      toast.success('Status proteksi berhasil diubah.');
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  const PICKUP_DROPOFF_COLUMNS = [
    { header: 'Kode', accessor: (row: Delivery) => row.code },
    { header: 'Asal', accessor: (row: Delivery) => row.origin },
    { header: 'Tujuan', accessor: (row: Delivery) => row.destination },
    { header: 'Kurir', accessor: (row: Delivery) => row.courierName || '-' },
    { header: 'Jarak (km)', accessor: (row: Delivery) => String(row.distanceKm) },
    { header: 'Jadwal', accessor: (row: Delivery) => formatDate(row.scheduledAt) },
    { header: 'Status', accessor: (row: Delivery) => DELIVERY_STATUS_META[row.status].label },
  ];
  const PICKUP_DROPOFF_PDF_META = {
    title: 'Rekap Data Gudang — Pickup & Dropoff',
    subtitle: 'Menu Utama / Pickup & Dropoff',
    description: 'Jadwal penjemputan (pickup) dan pengantaran (dropoff) barang, beserta kurir yang ditugaskan dan status terkini masing-masing jadwal.',
  };

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    switch (action) {
      case 'add':
        openCreateModal();
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
      case 'export':
        requestExport(rows, PICKUP_DROPOFF_COLUMNS, 'pickup-dropoff', PICKUP_DROPOFF_PDF_META);
        return;
      case 'print':
        printRowsToPdf(rows, PICKUP_DROPOFF_COLUMNS, { ...PICKUP_DROPOFF_PDF_META, generatedBy: user?.fullName });
        return;
      default:
        return;
    }
  }

  const columns: DataTableColumn<Delivery>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: Delivery) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<Delivery>,
        ]
      : []),
    { key: 'code', header: 'Kode', render: (row) => row.code },
    { key: 'origin', header: 'Asal', render: (row) => row.origin },
    { key: 'destination', header: 'Tujuan', render: (row) => row.destination },
    { key: 'courier', header: 'Kurir', render: (row) => row.courierName || '-' },
    { key: 'distance', header: 'Jarak', align: 'right', render: (row) => `${row.distanceKm} km` },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = DELIVERY_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/home/delivery/${row.id}`} className="text-xs font-semibold text-accent hover:underline">
            Lihat detail
          </Link>
          <button
            type="button"
            onClick={() => printResiPengiriman(row, user?.fullName)}
            title="Cetak Resi"
            className="rounded p-1 text-textMuted hover:bg-surfaceAlt hover:text-text"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {isStaff && row.status === 'menunggu' && !row.isProtected ? (
            <button
              type="button"
              onClick={() => openJadwalkanModal(row)}
              title="Jadwalkan (tugaskan kurir)"
              className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
            >
              <Truck className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isStaff && row.status === 'dijemput' && !row.isProtected ? (
            <button
              type="button"
              onClick={() => handleMulai(row)}
              title="Mulai Perjalanan (baru setelah ini ping GPS kurir bisa diterima)"
              className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
            >
              <PlayCircle className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isStaff && row.status === 'menunggu' && !row.isProtected ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Ubah"
              className="rounded p-1 text-textMuted hover:bg-surfaceAlt hover:text-text"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isStaff && !row.isProtected ? (
            <button
              type="button"
              onClick={() => handleDelete(row)}
              title="Hapus"
              className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.isProtected ? <Lock className="h-3.5 w-3.5 text-textMuted" aria-label="Dikunci (Protect)" /> : null}
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Pickup & Dropoff" breadcrumb="Menu Utama / Pickup & Dropoff">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Jadwal', value: rows.length },
          {
            id: 'menunggu',
            label: 'Menunggu',
            value: rows.filter((r) => r.status === 'menunggu').length,
          },
          {
            id: 'transit',
            label: 'Dalam Perjalanan',
            value: rows.filter((r) => r.status === 'perjalanan').length,
          },
          {
            id: 'terkirim',
            label: 'Terkirim',
            value: rows.filter((r) => r.status === 'terkirim').length,
          },
        ]}
      />
      <DeliveriesMap deliveries={rows} warehouses={gudangList?.data ?? []} fallbackCenter={BANDUNG_CENTER} />
      {isBulkMode ? (
        <p className="-mb-2 text-xs text-textMuted">
          Mode Modify aktif — {selectedIds.size} baris terpilih. Pilih baris (hanya status Menunggu yang
          bisa diubah) lalu pakai Change/Delete/Protect di action bar.
        </p>
      ) : null}
      <DataTable
        title="Daftar Pickup & Dropoff"
        description="Jadwal penjemputan dan pengantaran barang"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="pengiriman"
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Jadwal Pickup/Dropoff' : 'Jadwalkan Pickup'}
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
          Detail Pengiriman
        </p>
        <div className="-mt-2 grid grid-cols-2 gap-4">
          <Select
            label="Gudang Asal"
            value={form.gudangAsalId ? String(form.gudangAsalId) : ''}
            onChange={(e) => setForm({ ...form, gudangAsalId: Number(e.target.value) })}
            placeholder="Pilih gudang"
            options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
          <Select
            label="Jenis"
            value={form.jenisPengambilan ?? 'pickup'}
            onChange={(e) => setForm({ ...form, jenisPengambilan: e.target.value as 'pickup' | 'dropoff' })}
            options={[
              { label: 'Pickup', value: 'pickup' },
              { label: 'Dropoff', value: 'dropoff' },
            ]}
          />
        </div>

        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
          Penerima &amp; Tujuan
        </p>
        <div className="-mt-2 grid grid-cols-2 gap-4">
          <Input
            label="Nama Penerima"
            value={form.namaPenerima ?? ''}
            onChange={(e) => setForm({ ...form, namaPenerima: e.target.value })}
          />
          <Input
            label="Telepon Penerima"
            value={form.teleponPenerima ?? ''}
            onChange={(e) => setForm({ ...form, teleponPenerima: e.target.value })}
          />
        </div>
        <Input
          label="Alamat Tujuan"
          value={form.alamatTujuan ?? ''}
          onChange={(e) => setForm({ ...form, alamatTujuan: e.target.value })}
        />
        <div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude Tujuan (opsional)"
              placeholder="-6.9147"
              inputMode="decimal"
              value={form.destLat !== undefined && form.destLat !== null ? String(form.destLat) : ''}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === '' ? null : Number(raw);
                setForm({ ...form, destLat: raw === '' || Number.isNaN(parsed) ? null : parsed });
              }}
            />
            <Input
              label="Longitude Tujuan (opsional)"
              placeholder="107.6098"
              inputMode="decimal"
              value={form.destLng !== undefined && form.destLng !== null ? String(form.destLng) : ''}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === '' ? null : Number(raw);
                setForm({ ...form, destLng: raw === '' || Number.isNaN(parsed) ? null : parsed });
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-textMuted">
            Isi koordinat tujuan supaya peta pelacakan bisa menampilkan rute &amp; marker tujuan (bukan
            cuma posisi kurir). Bisa disalin dari Google Maps.
          </p>
        </div>

        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
          Jadwal &amp; Catatan
        </p>
        <div className="-mt-2 grid grid-cols-2 gap-4">
          <Input
            label="Tanggal Kirim"
            type="date"
            value={form.tanggalKirim ?? ''}
            onChange={(e) => setForm({ ...form, tanggalKirim: e.target.value })}
          />
          <Input
            label="Catatan (opsional)"
            value={form.catatan ?? ''}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        isOpen={jadwalkanTarget !== null}
        title={`Jadwalkan Kurir — ${jadwalkanTarget?.code ?? ''}`}
        onClose={() => setJadwalkanTarget(null)}
        onEnterSubmit={handleJadwalkanSubmit}
        footer={
          <>
            <Button variant="secondary" onClick={() => setJadwalkanTarget(null)}>
              Batal
            </Button>
            <Button onClick={handleJadwalkanSubmit} loading={isJadwalkanSaving}>
              Simpan
            </Button>
          </>
        }
      >
        <p className="text-xs text-textMuted">
          Menugaskan kurir mengubah status jadi &quot;Menunggu Dijemput&quot;. Setelah itu, gunakan tombol
          &quot;Mulai Perjalanan&quot; supaya statusnya jadi &quot;Dalam Perjalanan&quot; — status ini WAJIB
          sebelum kurir bisa mengirim update lokasi GPS.
        </p>
        <Input
          label="Nama Kurir"
          value={jadwalkanKurir}
          onChange={(e) => setJadwalkanKurir(e.target.value)}
        />
        <Input
          label="Telepon Kurir (opsional)"
          value={jadwalkanTelepon}
          onChange={(e) => setJadwalkanTelepon(e.target.value)}
        />
      </Modal>

      {exportDialog}
    </PageShell>
  );
}
