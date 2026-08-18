'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { warehousesApi, rakApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { useAuth } from '@/auth/AuthContext';
import { listErrorMessage, friendlyError } from '@/lib/utils/errors';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatNumber } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { RawGudang, RawRak } from '@/lib/api/raw-types';
import type { Warehouse } from '@/types';

const RAK_STATUS_LABEL: Record<RawRak['status'], string> = {
  kosong: 'Kosong',
  terisi_sebagian: 'Terisi Sebagian',
  penuh: 'Penuh',
};

const RAK_STATUS_VARIANT: Record<RawRak['status'], 'success' | 'warning' | 'danger'> = {
  kosong: 'success',
  terisi_sebagian: 'warning',
  penuh: 'danger',
};

interface RakFormState {
  kodeRak: string;
  kapasitas: number;
}

const EMPTY_RAK_FORM: RakFormState = { kodeRak: '', kapasitas: 0 };

export function WarehouseManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { rows, isLoading, error, mutate } = useResourceList('warehouses-management', warehousesApi);
  const [rakDetailFor, setRakDetailFor] = useState<Warehouse | null>(null);
  const [raks, setRaks] = useState<RawRak[] | null>(null);
  const [isLoadingRaks, setIsLoadingRaks] = useState(false);

  // Form Tambah/Ubah Rak — satu modal dipakai untuk dua mode, dibedakan
  // lewat `editingRak` (null = mode Tambah). SENGAJA cuma dua field (kode
  // rak & kapasitas) — "Terisi" & "Status" tidak bisa diisi manual di sini,
  // itu murni hasil hitungan backend dari transaksi Barang Masuk/Keluar
  // sungguhan (lihat catatan panjang di rakApi, modules.ts), bukan angka
  // yang boleh diketik bebas oleh siapa pun. Ini yang bikin fiturnya tetap
  // "sederhana, tanpa sensor" tapi angkanya tetap bisa dipercaya.
  const [rakFormOpen, setRakFormOpen] = useState(false);
  const [editingRak, setEditingRak] = useState<RawRak | null>(null);
  const [rakForm, setRakForm] = useState<RakFormState>(EMPTY_RAK_FORM);
  const [isSavingRak, setIsSavingRak] = useState(false);

  async function toggleStatus(warehouse: Warehouse): Promise<void> {
    const nextStatus = warehouse.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      await warehousesApi.update(warehouse.id, { status: nextStatus });
    } finally {
      await mutate();
    }
  }

  async function loadRaks(gudangId: string): Promise<void> {
    setIsLoadingRaks(true);
    try {
      const detail = (await warehousesApi.getById(gudangId)) as RawGudang;
      setRaks(detail.raks ?? []);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat rincian rak.'));
    } finally {
      setIsLoadingRaks(false);
    }
  }

  async function openRakDetail(row: Warehouse): Promise<void> {
    setRakDetailFor(row);
    setRaks(null);
    await loadRaks(row.id);
  }

  function openAddRak(): void {
    setEditingRak(null);
    setRakForm(EMPTY_RAK_FORM);
    setRakFormOpen(true);
  }

  function openEditRak(rak: RawRak): void {
    setEditingRak(rak);
    setRakForm({ kodeRak: rak.kodeRak, kapasitas: rak.kapasitas });
    setRakFormOpen(true);
  }

  async function handleSaveRak(): Promise<void> {
    if (!rakDetailFor) return;
    if (!editingRak && !rakForm.kodeRak.trim()) {
      toast.error('Kode rak wajib diisi.');
      return;
    }
    if (rakForm.kapasitas < 1) {
      toast.error('Kapasitas rak minimal 1 unit.');
      return;
    }
    setIsSavingRak(true);
    try {
      if (editingRak) {
        // Kode rak & gudang SENGAJA tidak bisa diubah lewat form ini
        // (lihat rakApi.update, modules.ts) — cuma kapasitas.
        await rakApi.update(editingRak.id, rakForm.kapasitas);
        toast.success('Rak berhasil diperbarui.');
      } else {
        await rakApi.create({
          kodeRak: rakForm.kodeRak.trim(),
          gudangId: Number(rakDetailFor.id),
          kapasitas: rakForm.kapasitas,
        });
        toast.success('Rak berhasil ditambahkan.');
      }
      setRakFormOpen(false);
      await loadRaks(rakDetailFor.id);
      await mutate(); // Total Kapasitas/Kapasitas Terpakai di StatsRow ikut berubah
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan rak.'));
    } finally {
      setIsSavingRak(false);
    }
  }

  async function handleDeleteRak(rak: RawRak): Promise<void> {
    if (!rakDetailFor) return;
    if (rak.terisi > 0) {
      // Backend juga menolak ini (409) — dicek di sini dulu supaya user
      // langsung dapat pesan jelas tanpa perlu bulat-bulat coba dulu.
      toast.error(`Rak ${rak.kodeRak} masih menyimpan ${formatNumber(rak.terisi)} unit barang — kosongkan dulu sebelum dihapus.`);
      return;
    }
    const ok = await confirm({
      title: 'Hapus Rak',
      message: `Rak ${rak.kodeRak} akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await rakApi.remove(rak.id);
      toast.success('Rak berhasil dihapus.');
      await loadRaks(rakDetailFor.id);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus rak.'));
    }
  }

  const columns: DataTableColumn<Warehouse>[] = [
    { key: 'name', header: 'Nama Gudang', render: (row) => row.name },
    { key: 'pic', header: 'PIC', render: (row) => row.picName },
    {
      key: 'utilisasi',
      header: 'Utilisasi',
      align: 'right',
      render: (row) =>
        row.capacity > 0 ? `${Math.round((row.usedCapacity / row.capacity) * 100)}%` : '-',
    },
    {
      key: 'items',
      header: 'Total Barang',
      align: 'right',
      render: (row) => formatNumber(row.totalItems),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status];
        return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status;
      },
    },
    {
      key: 'action',
      header: 'Aksi',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openRakDetail(row)}
            title="Kelola Rak"
            className="rounded p-1.5 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <Button variant="secondary" onClick={() => toggleStatus(row)}>
            {row.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Manajemen Gudang" breadcrumb="Manajemen / Manajemen Gudang">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Gudang', value: rows.length },
          {
            id: 'aktif',
            label: 'Gudang Aktif',
            value: rows.filter((r) => r.status === 'aktif').length,
          },
          {
            id: 'kapasitas',
            label: 'Total Kapasitas',
            value: `${formatNumber(rows.reduce((s, r) => s + r.capacity, 0))} Unit`,
          },
          {
            id: 'terpakai',
            label: 'Kapasitas Terpakai',
            value: `${formatNumber(rows.reduce((s, r) => s + r.usedCapacity, 0))} Unit`,
          },
        ]}
      />
      {/* Toggle Aktif/Nonaktifkan sudah punya tombol sendiri per baris.
          Tambah/hapus gudang dilakukan di menu WMS (/warehouse) yang
          punya form lengkap (nama, alamat, kapasitas, dst) — Add/Change/
          Delete/Protect generik di sini sengaja disembunyikan supaya
          tidak dobel dengan halaman itu. Print tetap diaktifkan untuk
          super admin (rekap status gudang siap cetak/A4). */}
      <DataTable
        title="Kelola Status Gudang"
        description="Aktifkan atau nonaktifkan gudang operasional"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        visibleActions={['print']}
        onRowAction={(action) => {
          if (action !== 'print') return;
          printRowsToPdf(
            rows,
            [
              { header: 'Nama Gudang', accessor: (r: Warehouse) => r.name },
              { header: 'PIC', accessor: (r: Warehouse) => r.picName },
              {
                header: 'Utilisasi',
                accessor: (r: Warehouse) =>
                  r.capacity > 0 ? `${Math.round((r.usedCapacity / r.capacity) * 100)}%` : '-',
              },
              { header: 'Total Barang', accessor: (r: Warehouse) => formatNumber(r.totalItems) },
              { header: 'Status', accessor: (r: Warehouse) => r.status },
            ],
            {
              title: 'Rekap Data Gudang — Status Gudang',
              subtitle: 'Manajemen / Manajemen Gudang',
              description: 'Status aktif/nonaktif tiap gudang operasional beserta utilisasi kapasitas dan total barang tersimpan.',
              generatedBy: user?.fullName,
            },
          );
        }}
      />

      <Modal
        isOpen={rakDetailFor !== null}
        title={rakDetailFor ? `Kelola Rak — ${rakDetailFor.name}` : 'Kelola Rak'}
        onClose={() => setRakDetailFor(null)}
        footer={
          <Button variant="secondary" onClick={() => setRakDetailFor(null)}>
            Tutup
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-textMuted">
              Rak = lokasi fisik penempatan barang. Kapasitas diisi manual; kolom Terisi dihitung
              otomatis dari transaksi Barang Masuk/Keluar yang memilih rak ini — bukan input manual.
            </p>
            <Button variant="secondary" onClick={openAddRak} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Tambah Rak
            </Button>
          </div>

          {(() => {
            if (isLoadingRaks) {
              return <p className="text-sm text-textMuted">Memuat rincian rak...</p>;
            }
            if (!raks || raks.length === 0) {
              return (
                <p className="text-sm text-textMuted">
                  Belum ada rak terdaftar di gudang ini — itu sebabnya Kapasitas Terpakai & Total
                  Barang masih 0 (angka itu dihitung dari SUM barang yang sudah ditempatkan ke rak
                  lewat proses Barang Masuk, bukan cuma total stok). Klik &quot;Tambah Rak&quot; di
                  atas untuk mulai melacak penempatan barang secara fisik.
                </p>
              );
            }
            return (
              <div className="flex flex-col gap-2">
                {raks.map((rak) => (
                  <div
                    key={rak.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-borderSoft px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-text">{rak.kodeRak}</p>
                      <Badge label={RAK_STATUS_LABEL[rak.status]} variant={RAK_STATUS_VARIANT[rak.status]} />
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-textMuted">
                        {formatNumber(rak.terisi)} / {formatNumber(rak.kapasitas)} unit
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditRak(rak)}
                          title="Ubah kapasitas"
                          className="rounded p-1.5 text-textMuted hover:bg-neutralBg hover:text-accentDark"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRak(rak)}
                          title="Hapus rak"
                          className="rounded p-1.5 text-textMuted hover:bg-neutralBg hover:text-dangerText"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Modal>

      <Modal
        isOpen={rakFormOpen}
        title={editingRak ? `Ubah Rak — ${editingRak.kodeRak}` : 'Tambah Rak'}
        onClose={() => setRakFormOpen(false)}
        onEnterSubmit={handleSaveRak}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRakFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveRak} disabled={isSavingRak}>
              {isSavingRak ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {editingRak ? (
            <p className="text-xs text-textMuted">
              Kode rak tidak bisa diubah setelah dibuat — hapus &amp; buat ulang kalau salah ketik.
            </p>
          ) : (
            <Input
              label="Kode Rak"
              placeholder="mis. A2-R05"
              value={rakForm.kodeRak}
              onChange={(e) => setRakForm({ ...rakForm, kodeRak: e.target.value })}
            />
          )}
          <NumberField
            label="Kapasitas (unit)"
            value={rakForm.kapasitas}
            onValueChange={(v) => setRakForm({ ...rakForm, kapasitas: v })}
          />
        </div>
      </Modal>
    </PageShell>
  );
}
