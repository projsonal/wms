'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CheckCircle2, Lock, Pencil, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, NumberField, CurrencyField, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { purchaseOrdersApi, suppliersApi, itemsApi, type PurchaseOrderPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { PO_STATUS_META } from '@/lib/utils/status';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';
import type { PurchaseOrder } from '@/types';

interface ItemRow {
  key: string;
  barangId: string;
  qtyPesan: number;
  hargaSatuan: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `po-row-${rowKeyCounter}`;
}

function emptyRow(): ItemRow {
  return { key: nextRowKey(), barangId: '', qtyPesan: 1, hargaSatuan: 0 };
}


export function PurchaseOrderContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  // Approval PO: dijaga izin `approval_reject` di backend -- karyawan
  // tidak akan pernah punya izin ini per default seed, jadi tombol
  // Setujui/Tolak cukup ditampilkan untuk staff (super_admin/admin);
  // backend tetap yang menegakkan aturannya secara nyata.
  const canApprove = isStaff;
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

  const { rows, isLoading, error, mutate } = useResourceList('purchase-orders', purchaseOrdersApi);
  const { data: supplierList } = useSWR('suppliers-for-po', () => suppliersApi.list({ pageSize: 200 }));
  const { data: itemList } = useSWR('items-for-po', () => itemsApi.list({ pageSize: 500 }));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [tanggalPo, setTanggalPo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateModal(): void {
    setEditingId(null);
    setSupplierId('');
    setTanggalPo(new Date().toISOString().slice(0, 10));
    setCatatan('');
    setItemRows([emptyRow()]);
    setIsModalOpen(true);
  }

  async function openEditModal(row: PurchaseOrder): Promise<void> {
    if (row.isProtected) {
      toast.error('Data ini dikunci (Protect) oleh super admin — tidak bisa diubah.');
      return;
    }
    try {
      const detail = await purchaseOrdersApi.getById(row.id);
      setEditingId(row.id);
      setSupplierId(String(detail.supplierId));
      setTanggalPo(detail.tanggalPo?.slice(0, 10) ?? '');
      setCatatan(detail.catatanPengajuan ?? '');
      const detailRows = (detail.items ?? []).map(
        (it): ItemRow => ({
          key: nextRowKey(),
          barangId: String(it.barangId),
          qtyPesan: it.qty,
          hargaSatuan: it.hargaSatuan,
        }),
      );
      setItemRows(detailRows.length > 0 ? detailRows : [emptyRow()]);
      setIsModalOpen(true);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat detail Purchase Order.'));
    }
  }

  function updateRow(key: string, patch: Partial<ItemRow>): void {
    setItemRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string): void {
    setItemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function handleSave(): Promise<void> {
    const validRows = itemRows.filter((r) => r.barangId && r.qtyPesan > 0);
    if (!supplierId || !tanggalPo || validRows.length === 0) {
      toast.error('Supplier, tanggal, dan minimal 1 barang wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: PurchaseOrderPayload = {
        supplierId: Number(supplierId),
        tanggalPo,
        catatanPengajuan: catatan,
        items: validRows.map((r) => ({
          barangId: Number(r.barangId),
          qtyPesan: r.qtyPesan,
          hargaSatuan: r.hargaSatuan,
        })),
      };
      if (editingId) {
        await purchaseOrdersApi.update(editingId, payload);
        toast.success('Purchase Order berhasil diperbarui.');
      } else {
        await purchaseOrdersApi.create(payload);
        toast.success('Purchase Order baru berhasil dibuat (status: Draft).');
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan Purchase Order.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAjukan(row: PurchaseOrder): Promise<void> {
    try {
      await purchaseOrdersApi.ajukan(row.id);
      toast.success('PO diajukan untuk approval.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengajukan PO.'));
    }
  }

  async function handleApprove(row: PurchaseOrder): Promise<void> {
    const ok = await confirm({
      title: 'Setujui Purchase Order?',
      message: `Setujui ${row.orderNumber} senilai ${formatCurrency(row.totalAmount)}?`,
      confirmLabel: 'Ya, Setujui',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await purchaseOrdersApi.approve(row.id);
      toast.success('PO disetujui.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyetujui PO.'));
    }
  }

  async function handleReject(row: PurchaseOrder): Promise<void> {
    const ok = await confirm({
      title: 'Tolak Purchase Order?',
      message: `Tolak ${row.orderNumber}?`,
      confirmLabel: 'Ya, Tolak',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await purchaseOrdersApi.reject(row.id);
      toast.success('PO ditolak.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menolak PO.'));
    }
  }

  async function handleDelete(row: PurchaseOrder): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Purchase Order',
      message: `Apakah yakin ingin menghapus data ini? (${row.orderNumber})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await purchaseOrdersApi.remove(row.id);
      toast.success('Purchase Order berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus PO — pastikan statusnya masih Draft.'));
    }
  }

  async function handleBulkChange(selectedRows: PurchaseOrder[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu baris data yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU Purchase Order (status Draft) untuk diubah.');
      return;
    }
    await openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: PurchaseOrder[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk dihapus.');
      return;
    }
    const nonDraft = selectedRows.filter((r) => r.rawStatus !== 'Draft');
    if (nonDraft.length > 0) {
      toast.error('Hanya Purchase Order berstatus Draft yang bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Purchase Order',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} Purchase Order terpilih?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => purchaseOrdersApi.remove(r.id)));
      toast.success(`${selectedRows.length} Purchase Order berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus sebagian/semua data terpilih.'));
    }
  }

  async function handleBulkProtect(selectedRows: PurchaseOrder[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dan pilih minimal satu baris untuk di-protect.');
      return;
    }
    const shouldProtect = selectedRows.some((r) => !r.isProtected);
    const ok = await confirm({
      title: shouldProtect ? 'Kunci (Protect) Data' : 'Buka Kunci Data',
      message: `${shouldProtect ? 'Kunci' : 'Buka kunci'} ${selectedRows.length} Purchase Order terpilih dari perubahan/penghapusan?`,
      confirmLabel: shouldProtect ? 'Ya, Kunci' : 'Ya, Buka Kunci',
      variant: 'protect',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => purchaseOrdersApi.setProtected(r.id, shouldProtect)));
      toast.success('Status proteksi berhasil diubah.');
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengubah status proteksi (khusus super admin).'));
    }
  }

  const PO_EXPORT_COLUMNS = [
    { header: 'No. Order', accessor: (row: PurchaseOrder) => row.orderNumber },
    { header: 'Supplier', accessor: (row: PurchaseOrder) => row.supplierName },
    { header: 'Jumlah Item', accessor: (row: PurchaseOrder) => String(row.itemCount) },
    { header: 'Total', accessor: (row: PurchaseOrder) => formatCurrency(row.totalAmount) },
    { header: 'Tanggal Order', accessor: (row: PurchaseOrder) => formatDate(row.orderDate) },
    { header: 'Status', accessor: (row: PurchaseOrder) => PO_STATUS_META[row.status].label },
  ];
  const PO_PDF_META = {
    title: 'Rekap Data Gudang — Purchase Order',
    subtitle: 'Menu Utama / Purchase Order',
    description: 'Riwayat pemesanan barang ke supplier beserta nilai total dan status alur persetujuan (draft/diajukan/disetujui/ditolak/dibatalkan).',
  };

  function handleExport(): void {
    requestExport(rows, PO_EXPORT_COLUMNS, 'purchase-order', PO_PDF_META);
  }

  function handlePrint(): void {
    printRowsToPdf(rows, PO_EXPORT_COLUMNS, { ...PO_PDF_META, generatedBy: user?.fullName });
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
      case 'protect':
        await handleBulkProtect(selectedRows);
        return;
      default:
        return;
    }
  }

  const columns: DataTableColumn<PurchaseOrder>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: PurchaseOrder) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<PurchaseOrder>,
        ]
      : []),
    { key: 'number', header: 'No. Order', render: (row) => row.orderNumber },
    { key: 'supplier', header: 'Supplier', render: (row) => row.supplierName },
    { key: 'items', header: 'Jumlah Item', align: 'right', render: (row) => row.itemCount },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => formatCurrency(row.totalAmount),
    },
    { key: 'order-date', header: 'Tanggal Order', render: (row) => formatDate(row.orderDate) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = PO_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.rawStatus === 'Draft' && isStaff && !row.isProtected ? (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              title="Ubah"
              className="rounded p-1 text-textMuted hover:bg-surfaceAlt hover:text-text"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.rawStatus === 'Draft' && isStaff && !row.isProtected ? (
            <button
              type="button"
              onClick={() => handleAjukan(row)}
              title="Ajukan untuk approval"
              className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {row.rawStatus === 'Diajukan' && canApprove ? (
            <>
              <button
                type="button"
                onClick={() => handleApprove(row)}
                title="Setujui"
                className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleReject(row)}
                title="Tolak"
                className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {row.rawStatus === 'Draft' && isStaff && !row.isProtected ? (
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

  const totalValue = rows.reduce((sum, po) => sum + po.totalAmount, 0);

  return (
    <PageShell title="Purchase Order" breadcrumb="Menu Utama / Purchase Order">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total PO', value: rows.length },
          {
            id: 'proses',
            label: 'Sedang Diproses',
            value: rows.filter((r) => r.status === 'diproses').length,
          },
          { id: 'nilai', label: 'Total Nilai PO', value: formatCurrency(totalValue) },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'selesai').length,
          },
        ]}
      />
      {/* Ajukan/Setujui/Tolak tetap lewat ikon per-baris (alur approval PO
          butuh konteks status per baris, tidak cocok jadi aksi bulk) — Add/
          Change/Delete/Modify/Protect sekarang lewat action bar geser di
          bawah, konsisten dengan tabel lain & mengikuti matrix perizinan. */}
      {isBulkMode ? (
        <p className="-mb-2 text-xs text-textMuted">
          Mode Modify aktif — {selectedIds.size} baris terpilih. Pilih baris (hanya status Draft yang bisa
          diubah/dihapus) lalu pakai Change/Delete/Protect di action bar.
        </p>
      ) : null}
      <DataTable
        title="Daftar Purchase Order"
        description="Riwayat pemesanan barang ke supplier"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="purchase_order"
      />
      {exportDialog}

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Purchase Order' : 'Buat Purchase Order'}
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
          label="Supplier"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          placeholder="Pilih supplier"
          options={(supplierList?.data ?? []).map((s) => ({ label: s.name, value: s.id }))}
        />
        <Input label="Tanggal PO" type="date" value={tanggalPo} onChange={(e) => setTanggalPo(e.target.value)} />
        <Input
          label="Catatan Pengajuan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Daftar Barang</p>
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
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Qty Pesan"
                  value={row.qtyPesan}
                  onValueChange={(value) => updateRow(row.key, { qtyPesan: value })}
                />
                <CurrencyField
                  label="Harga Satuan"
                  value={row.hargaSatuan}
                  onValueChange={(value) => updateRow(row.key, { hargaSatuan: value })}
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </PageShell>
  );
}
