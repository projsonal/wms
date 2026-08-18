'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CheckCircle2, Eye, Plus, Trash2 } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { inventoryApi, warehousesApi, itemsApi, type StockOpnamePayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatDate } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { RawStockOpname } from '@/lib/api/raw-types';

interface ItemRow {
  key: string;
  barangId: string;
  stokFisik: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `so-row-${rowKeyCounter}`;
}

function emptyRow(): ItemRow {
  return { key: nextRowKey(), barangId: '', stokFisik: 0 };
}

const SO_STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: 'Draft', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  dibatalkan: { label: 'Dibatalkan', variant: 'neutral' },
};

export function InventoryManagementContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canCreateOpname = isStaff || can('stock_opname', 'tambah');
  const canCompleteOpname = isStaff || can('stock_opname', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('stock-opname-sessions', {
    list: inventoryApi.listSessions,
  });
  const { data: warehouseList } = useSWR('warehouses-for-opname', () => warehousesApi.list({ pageSize: 100 }));
  const { data: itemList } = useSWR('items-for-opname', () => itemsApi.list({ pageSize: 500 }));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);

  // Detail baca-saja per sesi — sebelumnya sesi yang sudah "Selesai" tidak
  // punya aksi apa pun di baris (Complete/Delete cuma tampil untuk Draft),
  // jadi terlihat seperti tabelnya tidak bisa diapa-apakan sama sekali.
  // "Detail" tersedia untuk SEMUA status supaya hasil hitung fisik per SKU
  // (stok sistem vs stok fisik vs selisih) tetap bisa dilihat kapan pun.
  const [detailFor, setDetailFor] = useState<RawStockOpname | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  async function openDetail(row: RawStockOpname): Promise<void> {
    setIsLoadingDetail(true);
    setDetailFor(row);
    try {
      const full = await inventoryApi.getById(String(row.id));
      setDetailFor(full);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat rincian sesi.'));
      setDetailFor(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function openCreateModal(): void {
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([emptyRow()]);
    setIsModalOpen(true);
  }

  function updateRow(key: string, patch: Partial<ItemRow>): void {
    setItemRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string): void {
    setItemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function handleSave(): Promise<void> {
    const validRows = itemRows.filter((r) => r.barangId);
    if (!gudangId || !tanggal || validRows.length === 0) {
      toast.error('Gudang, tanggal, dan minimal 1 barang wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: StockOpnamePayload = {
        gudangId: Number(gudangId),
        tanggal,
        catatan,
        items: validRows.map((r) => ({ barangId: Number(r.barangId), stokFisik: r.stokFisik })),
      };
      await inventoryApi.create(payload);
      toast.success('Sesi Stock Opname berhasil dibuat (status: Draft).');
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membuat sesi Stock Opname.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleComplete(row: RawStockOpname): Promise<void> {
    const ok = await confirm({
      title: 'Selesaikan Stock Opname?',
      message: `Selisih hasil hitung fisik akan langsung diterapkan ke stok sistem untuk ${row.nomorOpname}. Lanjutkan?`,
      confirmLabel: 'Ya, Selesaikan',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await inventoryApi.complete(String(row.id));
      toast.success('Stock Opname selesai, stok sistem sudah disesuaikan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyelesaikan Stock Opname.'));
    }
  }

  async function handleDelete(row: RawStockOpname): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Sesi Stock Opname',
      message: `Apakah yakin ingin menghapus data ini? (${row.nomorOpname})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await inventoryApi.remove(String(row.id));
      toast.success('Sesi Stock Opname berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus — pastikan masih berstatus Draft.'));
    }
  }

  const columns: DataTableColumn<RawStockOpname>[] = [
    { key: 'nomor', header: 'No. Opname', render: (row) => row.nomorOpname },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudang?.nama ?? '-' },
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'items', header: 'Jumlah SKU', align: 'right', render: (row) => row.items?.length ?? 0 },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = SO_STATUS_META[row.status] ?? GENERIC_STATUS_META.selesai;
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openDetail(row)}
            title="Lihat rincian hasil hitung"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {row.status === 'draft' && canCompleteOpname ? (
            <button
              type="button"
              onClick={() => handleComplete(row)}
              title="Selesaikan & terapkan ke stok"
              className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
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
    <PageShell
      title="Manajemen Inventaris"
      breadcrumb="Manajemen / Manajemen Inventaris"
      action={canCreateOpname ? <Button onClick={openCreateModal}>+ Sesi Opname Baru</Button> : undefined}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Sesi', value: rows.length },
          { id: 'draft', label: 'Draft', value: rows.filter((r) => r.status === 'draft').length },
          { id: 'selesai', label: 'Selesai', value: rows.filter((r) => r.status === 'selesai').length },
        ]}
      />
      {/* Add/Complete/Delete sudah punya UI sendiri yang lebih pas (tombol
          header "+ Sesi Opname Baru" & ikon per-baris) — Modify (bulk
          edit) & Protect tidak relevan untuk sesi opname, jadi toolbar
          generik cukup sisakan Export supaya tidak ada tombol dekoratif
          yang terlihat aktif tapi sebenarnya tidak melakukan apa-apa. */}
      <DataTable
        title="Sesi Stock Opname"
        description="Sesi hitung fisik stok per gudang — selesaikan untuk menerapkan selisih ke stok sistem"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        visibleActions={['export', 'print']}
        module="stock_opname"
        onRowAction={(action) => {
          if (action !== 'export' && action !== 'print') return;
          const columns = [
            { header: 'No. Opname', accessor: (row: (typeof rows)[number]) => row.nomorOpname },
            { header: 'Gudang', accessor: (row: (typeof rows)[number]) => row.gudang?.nama ?? '-' },
            { header: 'Tanggal', accessor: (row: (typeof rows)[number]) => formatDate(row.tanggal) },
            { header: 'Jumlah SKU', accessor: (row: (typeof rows)[number]) => String(row.items?.length ?? 0) },
            { header: 'Status', accessor: (row: (typeof rows)[number]) => row.status },
          ];
          const pdfMeta = {
            title: 'Rekap Data Gudang — Sesi Stock Opname',
            subtitle: 'Manajemen / Manajemen Inventaris',
            description: 'Riwayat sesi hitung fisik stok (stock opname) per gudang, beserta jumlah SKU yang dihitung dan status penerapannya ke stok sistem.',
          };
          if (action === 'export') {
            requestExport(rows, columns, 'sesi-stock-opname', pdfMeta);
          } else {
            printRowsToPdf(rows, columns, { ...pdfMeta, generatedBy: user?.fullName });
          }
        }}
      />
      {exportDialog}

      <Modal
        isOpen={isModalOpen}
        title="Sesi Stock Opname Baru"
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
        <Select
          label="Gudang"
          value={gudangId}
          onChange={(e) => setGudangId(e.target.value)}
          placeholder="Pilih gudang"
          options={(warehouseList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
        />
        <Input label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        <Input label="Catatan (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Hasil Hitung Fisik</p>
            <button
              type="button"
              onClick={() => setItemRows((prev) => [...prev, emptyRow()])}
              className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Baris
            </button>
          </div>
          {itemRows.map((row, index) => (
            <div key={row.key} className="flex flex-col gap-3 rounded-md border border-borderSoft bg-neutralBg/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-textMuted">Baris {index + 1}</span>
                {itemRows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-xs text-dangerText hover:underline"
                  >
                    Hapus baris
                  </button>
                ) : null}
              </div>
              <Select
                label="Barang"
                value={row.barangId}
                onChange={(e) => updateRow(row.key, { barangId: e.target.value })}
                placeholder="Pilih barang"
                options={(itemList?.data ?? []).map((it) => ({ label: `${it.sku} — ${it.name}`, value: it.id }))}
              />
              <NumberField
                label="Stok Fisik (hasil hitung)"
                value={row.stokFisik}
                onValueChange={(value) => updateRow(row.key, { stokFisik: value })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={detailFor !== null}
        title={detailFor ? `Rincian — ${detailFor.nomorOpname}` : 'Rincian Sesi'}
        onClose={() => setDetailFor(null)}
        footer={
          <Button variant="secondary" onClick={() => setDetailFor(null)}>
            Tutup
          </Button>
        }
      >
        {isLoadingDetail ? (
          <p className="text-sm text-textMuted">Memuat rincian...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
              <p>Gudang: <span className="font-medium text-text">{detailFor?.gudang?.nama ?? '-'}</span></p>
              <p>Tanggal: <span className="font-medium text-text">{detailFor ? formatDate(detailFor.tanggal) : '-'}</span></p>
            </div>
            {detailFor?.catatan ? (
              <p className="text-xs text-textMuted">Catatan: {detailFor.catatan}</p>
            ) : null}
            <div className="flex flex-col gap-2">
              {(detailFor?.items ?? []).length === 0 ? (
                <p className="text-sm text-textMuted">Belum ada barang dihitung di sesi ini.</p>
              ) : (
                (detailFor?.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-borderSoft px-3 py-2 text-sm"
                  >
                    <p className="min-w-0 truncate font-medium text-text">
                      {item.barang?.nama ?? `Barang #${item.barangId}`}
                    </p>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-textMuted">
                      <span>Sistem: {item.stokSistem}</span>
                      <span>Fisik: {item.stokFisik}</span>
                      <span className={item.selisih !== 0 ? 'font-semibold text-dangerText' : 'font-semibold text-successText'}>
                        Selisih: {item.selisih}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
