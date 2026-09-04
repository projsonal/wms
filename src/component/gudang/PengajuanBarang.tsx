'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Trash2, CheckCircle2, XCircle, Plus, X, Eye, Printer, ChevronDown, Upload, FileText } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select, NumberField } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { pengajuanApi, pengajuanTemplatesApi, itemsApi, warehousesApi, barangSerialApi, kategoriApi, satuanApi } from '@/lib/api/modules';
import { QuickAddItemModal } from '@/component/gudang/QuickAddItemModal';
import { HttpError } from '@/lib/api/client';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils/format';
import { GENERIC_STATUS_META, PENGAJUAN_JENIS_META } from '@/lib/utils/status';
import { printPengajuanBarang } from '@/lib/utils/print-pengajuan';
import { useServerPaginatedList } from '@/lib/hooks/useServerPaginatedList';
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch';
import { TableSearchInput } from '@/component/ui/TableSearchInput';
import type { RawPengajuanBarang, RawPengajuanBarangItem, RawPengajuanTemplate, PengajuanBarangJenis } from '@/lib/api/raw-types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

interface ItemRow {
  key: string;
  barangId: string;
  qty: number;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

const EMPTY_ITEM_ROW: Omit<ItemRow, 'key'> = { barangId: '', qty: 1 };

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    // Kalau backend mengirim rincian per-field (mis. respons 422 "validasi
    // gagal" dari go-playground/validator), tampilkan field mana yang
    // bermasalah supaya penggunanya tidak cuma lihat pesan generik yang
    // membingungkan — sebelumnya rincian ini ada di err.fieldErrors tapi
    // tidak pernah ditampilkan sama sekali.
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      const detail = Object.entries(err.fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('; ');
      return `${err.message} (${detail})`;
    }
    return err.message;
  }
  return fallback;
}

function modalTitle(editingId: string | null, jenis: PengajuanBarangJenis): string {
  if (editingId) return 'Ubah Pengajuan Barang';
  if (jenis === 'template') return 'Ajukan Formulir Template';
  return 'Ajukan Pengeluaran Barang';
}

const STATUS_FILTER_OPTIONS = [
  { label: 'Menunggu Persetujuan', value: 'diajukan' },
  { label: 'Disetujui', value: 'disetujui' },
  { label: 'Ditolak', value: 'ditolak' },
];

// JENIS_FILTER_OPTIONS: dipakai tab filter daftar (termasuk "template" —
// semua pengajuan berbasis formulir digabung 1 tab, bukan per-formulir).
// JENIS_CREATE_OPTIONS: dipakai <Select> di modal tambah/ubah — cuma 3
// jenis berbasis barang, karena jenis "template" HANYA dibuat lewat dropdown
// "Template Formulir" (lihat TemplateDropdownButton), bukan dari Select ini.
const JENIS_FILTER_OPTIONS: { label: string; value: PengajuanBarangJenis }[] = [
  { label: 'Barang Masuk', value: 'masuk' },
  { label: 'Barang Keluar', value: 'keluar' },
  { label: 'Barang Rusak', value: 'rusak' },
  { label: 'Formulir Template', value: 'template' },
];

const JENIS_CREATE_OPTIONS: { label: string; value: PengajuanBarangJenis }[] = [
  { label: 'Barang Masuk', value: 'masuk' },
  { label: 'Barang Keluar', value: 'keluar' },
  { label: 'Barang Rusak', value: 'rusak' },
];

const JENIS_TABS: { label: string; value: string }[] = [{ label: 'Semua', value: '' }, ...JENIS_FILTER_OPTIONS];

const JENIS_GUDANG_LABEL: Record<PengajuanBarangJenis, string> = {
  masuk: 'Gudang Penerima',
  keluar: 'Gudang Asal',
  rusak: 'Gudang/Lokasi',
  template: 'Gudang/Cabang',
};

const JENIS_SETUJUI_HINT: Record<PengajuanBarangJenis, string> = {
  masuk:
    'Menyetujui pengajuan ini akan otomatis membuat dokumen Barang Masuk berstatus draft — harga satuannya dilengkapi belakangan di halaman Barang Masuk.',
  keluar:
    'Menyetujui pengajuan ini akan langsung memotong stok gudang dan membuat dokumen Barang Keluar secara otomatis.',
  rusak:
    'Menyetujui pengajuan ini akan otomatis membuat laporan Barang Rusak (1 baris per unit) yang masuk ke antrean pengecekan staf.',
  template:
    'Menyetujui pengajuan ini hanya mengubah statusnya menjadi disetujui — tidak ada dokumen yang dibuat otomatis.',
};

interface PengajuanJenisTabsProps {
  value: string;
  onChange: (value: string) => void;
}

function PengajuanJenisTabs({ value, onChange }: PengajuanJenisTabsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {JENIS_TABS.map((tab) => (
        <button
          key={tab.value || 'semua'}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            value === tab.value ? 'bg-accent text-white' : 'text-textMuted hover:bg-surfaceAlt',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function renderPengajuanJenisBadge(row: RawPengajuanBarang): React.JSX.Element {
  if (row.jenis === 'template') {
    const label = row.template?.nama || PENGAJUAN_JENIS_META.template.label;
    return <Badge label={label} variant="warning" />;
  }
  const meta = PENGAJUAN_JENIS_META[row.jenis] ?? { label: row.jenis, variant: 'neutral' as const };
  return <Badge label={meta.label} variant={meta.variant} />;
}

interface PengajuanRowActionsProps {
  row: RawPengajuanBarang;
  currentUserId: number | undefined;
  canApprove: boolean;
  onDetail: () => void;
  onPrint: () => void;
  onSetujui: () => void;
  onTolak: () => void;
  onDelete: () => void;
}

function renderPengajuanItemsCell(row: RawPengajuanBarang): string {
  if (row.jenis === 'template') {
    return row.template?.nama || 'Formulir Template';
  }
  const names = (row.items ?? []).map((it) => it.barang?.nama).filter(Boolean) as string[];
  if (names.length === 0) return '-';
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} lainnya`;
}

function renderPengajuanStatusBadge(row: RawPengajuanBarang): React.JSX.Element {
  const meta = GENERIC_STATUS_META[row.status] ?? { label: row.status, variant: 'neutral' as const };
  return (
    <Badge
      label={meta.label}
      variant={meta.variant}
      title={row.status === 'ditolak' && row.catatanProses ? `Alasan: ${row.catatanProses}` : undefined}
    />
  );
}

function PengajuanRowActions({
  row,
  currentUserId,
  canApprove,
  onDetail,
  onPrint,
  onSetujui,
  onTolak,
  onDelete,
}: PengajuanRowActionsProps): React.JSX.Element {
  const isMenunggu = row.status === 'diajukan';
  const isOwner = row.diajukanOleh === currentUserId;

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onDetail}
        title="Lihat rincian"
        className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onPrint}
        title="Cetak dokumen pengajuan"
        className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
      >
        <Printer className="h-3.5 w-3.5" />
      </button>
      {isMenunggu && canApprove && !isOwner ? (
        <>
          <button
            type="button"
            onClick={onSetujui}
            title="Setujui"
            className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onTolak}
            title="Tolak"
            className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
      {isMenunggu && isOwner ? (
        <button
          type="button"
          onClick={onDelete}
          title="Hapus"
          className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

interface PengajuanProsesModalProps {
  target: { row: RawPengajuanBarang; mode: 'setujui' | 'tolak' } | null;
  namaGa: string;
  onNamaGaChange: (value: string) => void;
  jabatanGa: string;
  onJabatanGaChange: (value: string) => void;
  catatanProses: string;
  onCatatanProsesChange: (value: string) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function prosesModalTitle(target: PengajuanProsesModalProps['target']): string {
  if (!target) return '';
  return target.mode === 'setujui'
    ? `Setujui Pengajuan — ${target.row.nomorPengajuan}`
    : `Tolak Pengajuan — ${target.row.nomorPengajuan}`;
}

function prosesModalDescription(mode: 'setujui' | 'tolak' | undefined, jenis: PengajuanBarangJenis | undefined): string {
  if (mode !== 'setujui') {
    return 'Jelaskan alasan penolakan supaya pengaju tahu apa yang perlu diperbaiki sebelum mengajukan ulang.';
  }
  const hint = jenis ? JENIS_SETUJUI_HINT[jenis] : JENIS_SETUJUI_HINT.keluar;
  return `${hint} Nama & jabatan di bawah akan dicetak di kolom tanda tangan "Bagian General Affairs (GA)" pada dokumen — boleh dikosongkan lalu diisi tulis tangan.`;
}

function PengajuanProsesModal({
  target,
  namaGa,
  onNamaGaChange,
  jabatanGa,
  onJabatanGaChange,
  catatanProses,
  onCatatanProsesChange,
  isSaving,
  onClose,
  onSubmit,
}: PengajuanProsesModalProps): React.JSX.Element {
  const mode = target?.mode;
  return (
    <Modal
      isOpen={target !== null}
      title={prosesModalTitle(target)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={onSubmit} loading={isSaving}>
            {mode === 'setujui' ? 'Ya, Setujui' : 'Ya, Tolak'}
          </Button>
        </>
      }
    >
      <p className="text-xs text-textMuted">{prosesModalDescription(mode, target?.row.jenis)}</p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Nama (GA)" value={namaGa} onChange={(e) => onNamaGaChange(e.target.value)} />
        <Input label="Jabatan (GA)" value={jabatanGa} onChange={(e) => onJabatanGaChange(e.target.value)} />
      </div>
      <Input
        label={mode === 'tolak' ? 'Alasan Penolakan (wajib)' : 'Catatan (opsional)'}
        value={catatanProses}
        onChange={(e) => onCatatanProsesChange(e.target.value)}
      />
    </Modal>
  );
}

interface PengajuanItemRowsEditorProps {
  itemRows: ItemRow[];
  barangOptions: { label: string; value: string }[];
  onAddRow: () => void;
  onUpdateRow: (index: number, patch: Partial<ItemRow>) => void;
  onRemoveRow: (index: number) => void;
  onQuickAdd: (index: number) => void;
}

function PengajuanItemRowsEditor({
  itemRows,
  barangOptions,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onQuickAdd,
}: PengajuanItemRowsEditorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-borderSoft p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Daftar Barang</span>
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah Baris
        </button>
      </div>

      {itemRows.map((row, index) => (
        <div key={row.key} className="flex flex-col gap-3 rounded-md border border-borderSoft bg-neutralBg/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-textMuted">Baris {index + 1}</span>
            <button
              type="button"
              onClick={() => onRemoveRow(index)}
              disabled={itemRows.length === 1}
              className="flex items-center gap-1 text-xs font-medium text-dangerText hover:underline disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X className="h-3 w-3" /> Hapus baris
            </button>
          </div>
          <Select
            label="Barang"
            value={row.barangId}
            onChange={(e) => onUpdateRow(index, { barangId: e.target.value })}
            placeholder="Pilih barang"
            options={barangOptions}
          />
          <button
            type="button"
            onClick={() => onQuickAdd(index)}
            className="-mt-1 flex items-center gap-1 self-start text-xs font-semibold text-accentDark hover:underline"
          >
            <Plus className="h-3 w-3" /> Barang belum ada di daftar? Tambah baru
          </button>
          <NumberField label="Qty" value={row.qty} onValueChange={(value) => onUpdateRow(index, { qty: value })} />
        </div>
      ))}
    </div>
  );
}

interface PengajuanDetailModalProps {
  doc: RawPengajuanBarang | null;
  currentUserId: number | undefined;
  onClose: () => void;
  onEdit: (doc: RawPengajuanBarang) => void;
  onPrint: (doc: RawPengajuanBarang) => void;
}

function PengajuanDetailStatusInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element | null {
  if (doc.status === 'diajukan') return null;
  return (
    <span className="col-span-2">
      Diproses oleh: <span className="font-medium text-text">{doc.pemroses?.fullName ?? '-'}</span>
      {doc.catatanProses ? <> — <span className="italic">&quot;{doc.catatanProses}&quot;</span></> : null}
    </span>
  );
}

function PengajuanDetailBarangKeluarInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element | null {
  if (!doc.barangKeluar) return null;
  const statusText =
    doc.barangKeluar.status === 'draft'
      ? 'draft — perlu dituntaskan di Barang Keluar (ada barang ber-nomor-seri)'
      : 'selesai, stok terpotong';
  return (
    <span className="col-span-2">
      Dokumen Barang Keluar: <span className="font-medium text-text">{doc.barangKeluar.nomorPengeluaran}</span> ({statusText})
    </span>
  );
}

function PengajuanDetailBarangMasukInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element | null {
  if (!doc.barangMasuk) return null;
  return (
    <span className="col-span-2">
      Dokumen Barang Masuk: <span className="font-medium text-text">{doc.barangMasuk.nomorPenerimaan}</span> (draft — lengkapi
      harga satuan &amp; tuntaskan di halaman Barang Masuk)
    </span>
  );
}

function PengajuanDetailBarangRusakInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element | null {
  const rows = doc.barangRusak ?? [];
  if (rows.length === 0) return null;
  return (
    <span className="col-span-2">
      Laporan Barang Rusak: <span className="font-medium text-text">{rows.length} unit</span> otomatis dibuat, menunggu
      pengecekan staf di halaman Barang Rusak.
    </span>
  );
}

function PengajuanDetailDocInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element {
  return (
    <>
      <PengajuanDetailBarangKeluarInfo doc={doc} />
      <PengajuanDetailBarangMasukInfo doc={doc} />
      <PengajuanDetailBarangRusakInfo doc={doc} />
    </>
  );
}

function PengajuanDetailItems({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element {
  const items = doc.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-textMuted">Belum ada data barang.</p>;
  }
  return (
    <>
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 rounded-md border border-borderSoft p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{it.barang?.nama ?? `Barang #${it.barangId}`}</p>
            <p className="text-[11px] text-textMuted">Kode: {it.barang?.kodeBarang ?? '-'}</p>
          </div>
          <span className="shrink-0 text-xs text-textMuted">Qty: {it.qty}</span>
        </div>
      ))}
    </>
  );
}

function PengajuanDetailTemplateInfo({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element | null {
  if (doc.jenis !== 'template') return null;
  return (
    <span className="col-span-2">
      Formulir: <span className="font-medium text-text">{doc.template?.nama || '-'}</span>
      {doc.template?.deskripsi ? <span className="text-textMuted"> — {doc.template.deskripsi}</span> : null}
    </span>
  );
}

function PengajuanDetailBody({ doc }: { doc: RawPengajuanBarang }): React.JSX.Element {
  const jenisMeta =
    doc.jenis === 'template'
      ? { label: doc.template?.nama || PENGAJUAN_JENIS_META.template.label, variant: 'warning' as const }
      : PENGAJUAN_JENIS_META[doc.jenis] ?? { label: doc.jenis, variant: 'neutral' as const };
  const isTemplateJenis = doc.jenis === 'template';
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 text-xs text-textMuted">
        <span>Jenis: <Badge label={jenisMeta.label} variant={jenisMeta.variant} /></span>
        <span>{JENIS_GUDANG_LABEL[doc.jenis] ?? 'Gudang'}: <span className="font-medium text-text">{doc.gudang?.nama ?? '-'}</span></span>
        <span>Tanggal: <span className="font-medium text-text">{formatDate(doc.tanggal)}</span></span>
        <PengajuanDetailTemplateInfo doc={doc} />
        <span className="col-span-2">Keperluan: <span className="font-medium text-text">{doc.keperluan}</span></span>
        <PengajuanDetailStatusInfo doc={doc} />
        <PengajuanDetailDocInfo doc={doc} />
      </div>
      {isTemplateJenis ? null : <PengajuanDetailItems doc={doc} />}
    </div>
  );
}

function PengajuanDetailModal({
  doc,
  currentUserId,
  onClose,
  onEdit,
  onPrint,
}: PengajuanDetailModalProps): React.JSX.Element {
  const canEdit = doc !== null && doc.status === 'diajukan' && doc.diajukanOleh === currentUserId;
  const canPrint = doc !== null;
  return (
    <Modal
      isOpen={doc !== null}
      title={`Rincian Pengajuan — ${doc?.nomorPengajuan ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {canEdit && doc ? (
            <Button variant="secondary" onClick={() => onEdit(doc)}>
              Ubah
            </Button>
          ) : null}
          {canPrint && doc ? (
            <Button variant="secondary" onClick={() => onPrint(doc)}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak
            </Button>
          ) : null}
          <Button onClick={onClose}>Tutup</Button>
        </>
      }
    >
      {doc ? <PengajuanDetailBody doc={doc} /> : null}
    </Modal>
  );
}

interface TemplateDropdownButtonProps {
  templates: RawPengajuanTemplate[];
  isLoadingTemplates: boolean;
  isStaff: boolean;
  onSelectTemplate: (template: RawPengajuanTemplate) => void;
  onUploadClick: () => void;
  onDeleteTemplate: (template: RawPengajuanTemplate) => void;
}

// Dropdown "Template Formulir" — menggantikan tab "Pengajuan ke Atasan"
// sepenuhnya. Dibangun manual (bukan pakai komponen shadcn/Radix
// dropdown-menu yang sudah ada tapi belum pernah dipakai di file lain di
// aplikasi ini) supaya gaya & perilakunya konsisten dengan pola tombol
// polos + state lokal yang sudah dipakai di komponen ini (mis.
// PengajuanJenisTabs).
function TemplateDropdownButton({
  templates,
  isLoadingTemplates,
  isStaff,
  onSelectTemplate,
  onUploadClick,
  onDeleteTemplate,
}: TemplateDropdownButtonProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button type="button" variant="secondary" onClick={() => setIsOpen((prev) => !prev)}>
        <FileText className="mr-1.5 h-3.5 w-3.5" /> Template Formulir
        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
      </Button>
      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-borderSoft bg-surface shadow-lg">
          <div className="max-h-64 overflow-y-auto p-1">
            {isLoadingTemplates ? <p className="px-3 py-2 text-xs text-textMuted">Memuat template...</p> : null}
            {!isLoadingTemplates && templates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-textMuted">Belum ada template formulir diunggah.</p>
            ) : null}
            {templates.map((template) => (
              <div key={template.id} className="group flex items-center justify-between gap-1 rounded px-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTemplate(template);
                    setIsOpen(false);
                  }}
                  title={template.deskripsi || template.nama}
                  className="flex-1 truncate rounded px-2 py-2 text-left text-sm text-text hover:bg-neutralBg"
                >
                  {template.nama}
                </button>
                {isStaff ? (
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(template)}
                    title="Hapus template"
                    className="rounded p-1 text-textMuted opacity-0 hover:bg-dangerBg hover:text-dangerText group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {isStaff ? (
            <div className="border-t border-borderSoft p-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onUploadClick();
                }}
                className="flex w-full items-center gap-1.5 rounded px-2 py-2 text-left text-xs font-semibold text-accentDark hover:bg-neutralBg"
              >
                <Upload className="h-3.5 w-3.5" /> Upload Template Baru
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface TemplateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

// Modal upload formulir kosong (PDF/DOC/DOCX) oleh admin/super admin —
// begitu diunggah, formulir ini langsung muncul di dropdown Template
// Formulir untuk siapa pun dan menjadi jenis pengajuan aktif (bukan
// sekadar berkas statis) lewat alur approve/reject/status yang sama.
function TemplateUploadModal({ isOpen, onClose, onUploaded }: TemplateUploadModalProps): React.JSX.Element {
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function resetAndClose(): void {
    setNama('');
    setDeskripsi('');
    setFile(null);
    onClose();
  }

  async function handleUpload(): Promise<void> {
    if (!nama.trim()) {
      toast.error('Nama template wajib diisi.');
      return;
    }
    if (!file) {
      toast.error('Pilih berkas formulir (PDF/DOC/DOCX) terlebih dahulu.');
      return;
    }
    setIsUploading(true);
    try {
      await pengajuanTemplatesApi.upload({ nama: nama.trim(), deskripsi: deskripsi.trim() || undefined, file });
      toast.success('Template formulir berhasil diunggah.');
      onUploaded();
      resetAndClose();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengunggah template formulir.'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Upload Template Formulir Baru"
      onClose={resetAndClose}
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>
            Batal
          </Button>
          <Button onClick={handleUpload} loading={isUploading}>
            Unggah
          </Button>
        </>
      }
    >
      <p className="text-xs text-textMuted">
        Formulir kosong (PDF, DOC, atau DOCX, maks. 3MB) yang bisa dipilih siapa saja saat mengajukan lewat dropdown
        &quot;Template Formulir&quot;. Mencetaknya nanti akan mengunduh berkas ini apa adanya.
      </p>
      <Input label="Nama Template" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Formulir Pengajuan Cuti" />
      <Input
        label="Deskripsi (opsional)"
        value={deskripsi}
        onChange={(e) => setDeskripsi(e.target.value)}
        placeholder="Keterangan singkat formulir ini"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-textMuted">Berkas (PDF/DOC/DOCX)</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-accentDark"
        />
      </div>
    </Modal>
  );
}

export function PengajuanBarangContent(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canApprove = isStaff || can('pengajuan_barang', 'approvalReject');
  const confirm = useConfirm();

  const { data: barangList, mutate: mutateBarangList } = useSWR('items-for-pengajuan', () => itemsApi.list({ pageSize: 200 }));
  const { data: kategoriList } = useSWR('kategori-list', () => kategoriApi.list());
  const { data: satuanList } = useSWR('satuan-list', () => satuanApi.list());
  const { data: gudangList } = useSWR('warehouses-for-pengajuan', () => warehousesApi.list({ pageSize: 100 }));
  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    mutate: mutateTemplates,
  } = useSWR('pengajuan-templates-active', () => pengajuanTemplatesApi.list({ onlyActive: true, pageSize: 100 }));
  const templates = templatesData?.data ?? [];
  const [isTemplateUploadOpen, setIsTemplateUploadOpen] = useState(false);

  const [quickAddForRowIndex, setQuickAddForRowIndex] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');
  const [filterBarangId, setFilterBarangId] = useState('');

  const { data: summary, mutate: mutateSummary } = useSWR('pengajuan-barang-summary', () => pengajuanApi.summary());

  const { input: searchInput, setInput: setSearchInput, term: searchTerm } = useDebouncedSearch();
  const { rows, isLoading, mutate, serverPagination } = useServerPaginatedList('pengajuan-barang', pengajuanApi, {
    status: statusFilter || undefined,
    jenis: jenisFilter || undefined,
    barang_id: filterBarangId || undefined,
    search: searchTerm || undefined,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jenis, setJenis] = useState<PengajuanBarangJenis>('keluar');
  const [templateId, setTemplateId] = useState('');
  const [templateNama, setTemplateNama] = useState('');
  const [gudangId, setGudangId] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [namaPencatat, setNamaPencatat] = useState('');
  const [jabatanPencatat, setJabatanPencatat] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);

  const [detailDoc, setDetailDoc] = useState<RawPengajuanBarang | null>(null);

  const [prosesTarget, setProsesTarget] = useState<{ row: RawPengajuanBarang; mode: 'setujui' | 'tolak' } | null>(null);
  const [namaGa, setNamaGa] = useState('');
  const [jabatanGa, setJabatanGa] = useState('');
  const [catatanProses, setCatatanProses] = useState('');
  const [isProsesSaving, setIsProsesSaving] = useState(false);

  function openCreateModal(defaultJenis: PengajuanBarangJenis = 'keluar'): void {
    setEditingId(null);
    setJenis(defaultJenis);
    setTemplateId('');
    setTemplateNama('');
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKeperluan('');
    // Sengaja dikosongkan (bukan diisi otomatis dari nama akun yang login) —
    // yang tanda tangan di kolom "Bagian Pencatatan/Gudang" pada dokumen
    // cetak bisa jadi orang lain, bukan yang mengisi form pengajuan ini.
    setNamaPencatat('');
    setJabatanPencatat('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
  }

  // Entry point khusus dropdown "Template Formulir" — jenisnya dikunci ke
  // 'template' dan templateId/templateNama langsung diisi dari formulir yang
  // dipilih, jadi user tidak perlu (dan tidak bisa) memilih jenis lain lagi.
  function openCreateModalForTemplate(template: RawPengajuanTemplate): void {
    setEditingId(null);
    setJenis('template');
    setTemplateId(String(template.id));
    setTemplateNama(template.nama);
    setGudangId('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKeperluan('');
    setNamaPencatat('');
    setJabatanPencatat('');
    setItemRows([{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
  }

  function openEditModal(row: RawPengajuanBarang): void {
    if (row.status !== 'diajukan') {
      toast.error('Hanya pengajuan berstatus "Menunggu Persetujuan" yang bisa diubah.');
      return;
    }
    setEditingId(String(row.id));
    setJenis(row.jenis ?? 'keluar');
    setTemplateId(row.templateId ? String(row.templateId) : '');
    setTemplateNama(row.template?.nama ?? '');
    setGudangId(String(row.gudangId));
    setTanggal(row.tanggal ? row.tanggal.slice(0, 10) : '');
    setKeperluan(row.keperluan ?? '');
    setNamaPencatat(row.namaPencatat ?? '');
    setJabatanPencatat(row.jabatanPencatat ?? '');
    const rowsFromDoc = (row.items ?? []).map((it) => ({
      key: nextRowKey(),
      barangId: String(it.barangId),
      qty: it.qty ?? 1,
    }));
    setItemRows(rowsFromDoc.length > 0 ? rowsFromDoc : [{ ...EMPTY_ITEM_ROW, key: nextRowKey() }]);
    setIsModalOpen(true);
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>): void {
    setItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeItemRow(index: number): void {
    setItemRows((prev) => prev.filter((_, i) => i !== index));
  }

  function validatePengajuanForm(): string | null {
    if (!gudangId || !tanggal || !keperluan) {
      return 'Gudang, tanggal, dan keperluan wajib diisi.';
    }
    if (jenis === 'template') {
      if (!templateId) {
        return 'Pilih formulir template terlebih dahulu.';
      }
      return null;
    }
    const hasValidItem = itemRows.some((r) => r.barangId && r.qty > 0);
    if (!hasValidItem) {
      return 'Tambahkan minimal 1 baris barang dengan qty > 0.';
    }
    return null;
  }

  async function handleSave(): Promise<void> {
    const validationError = validatePengajuanForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const isTemplateJenis = jenis === 'template';
    const items = itemRows.filter((r) => r.barangId && r.qty > 0);
    setIsSaving(true);
    try {
      const payload = {
        jenis,
        gudangId: Number(gudangId),
        tanggal,
        keperluan,
        templateId: isTemplateJenis ? Number(templateId) : undefined,
        namaPencatat,
        jabatanPencatat,
        items: isTemplateJenis ? [] : items.map((r) => ({ barang_id: Number(r.barangId), qty: r.qty })),
      };
      if (editingId) {
        await pengajuanApi.update(editingId, payload);
        toast.success('Pengajuan barang berhasil diubah.');
      } else {
        await pengajuanApi.create(payload);
        toast.success('Pengajuan barang berhasil dikirim, menunggu persetujuan.');
      }
      setIsModalOpen(false);
      setEditingId(null);
      await mutate();
      await mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, editingId ? 'Gagal mengubah pengajuan barang.' : 'Gagal membuat pengajuan barang.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(row: RawPengajuanBarang): Promise<void> {
    if (row.status !== 'diajukan') {
      toast.error('Hanya pengajuan berstatus "Menunggu Persetujuan" yang bisa dihapus.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Pengajuan',
      message: `Apakah yakin ingin menghapus data ini? (${row.nomorPengajuan})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await pengajuanApi.remove(String(row.id));
      toast.success('Pengajuan berhasil dihapus.');
      await mutate();
      await mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus pengajuan.'));
    }
  }

  async function handleDeleteTemplate(template: RawPengajuanTemplate): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Template',
      message: `Apakah yakin ingin menghapus template "${template.nama}"? Pengajuan yang sudah memakai template ini tidak akan terpengaruh.`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await pengajuanTemplatesApi.remove(String(template.id));
      toast.success('Template berhasil dihapus.');
      await mutateTemplates();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus template.'));
    }
  }

  function openProsesModal(row: RawPengajuanBarang, mode: 'setujui' | 'tolak'): void {
    setProsesTarget({ row, mode });
    setNamaGa('');
    setJabatanGa('');
    setCatatanProses('');
  }

  async function submitProses(): Promise<void> {
    if (!prosesTarget) return;
    if (prosesTarget.mode === 'tolak' && catatanProses.trim().length < 3) {
      toast.error('Alasan penolakan wajib diisi (minimal 3 karakter).');
      return;
    }
    setIsProsesSaving(true);
    try {
      if (prosesTarget.mode === 'setujui') {
        await pengajuanApi.setujui(String(prosesTarget.row.id), {
          namaGa,
          jabatanGa,
          catatan: catatanProses,
        });
        const jenisApproved = prosesTarget.row.jenis ?? 'keluar';
        const successMsg: Record<PengajuanBarangJenis, string> = {
          keluar: 'Pengajuan disetujui — stok dipotong & dokumen Barang Keluar otomatis dibuat.',
          masuk: 'Pengajuan disetujui — dokumen Barang Masuk (draft) otomatis dibuat.',
          rusak: 'Pengajuan disetujui — laporan Barang Rusak otomatis dibuat, menunggu pengecekan staf.',
          template: 'Pengajuan berhasil disetujui.',
        };
        toast.success(successMsg[jenisApproved] ?? successMsg.keluar);
      } else {
        await pengajuanApi.tolak(String(prosesTarget.row.id), {
          namaGa,
          jabatanGa,
          catatan: catatanProses,
        });
        toast.success('Pengajuan berhasil ditolak.');
      }
      setProsesTarget(null);
      await mutate();
      await mutateSummary();
    } catch (err) {
      toast.error(
        friendlyError(err, prosesTarget.mode === 'setujui' ? 'Gagal menyetujui pengajuan.' : 'Gagal menolak pengajuan.'),
      );
    } finally {
      setIsProsesSaving(false);
    }
  }

  // Untuk tiap item yang isSerialized, ambil daftar nomor seri yang masih
  // "tersedia" di gudang asal pengajuan ini — dicetak sebagai tabel
  // tambahan di dokumen (lihat print-pengajuan.ts). Item yang tidak
  // isSerialized dilewati sepenuhnya (serialNumbers tetap undefined),
  // supaya tampilan dokumen untuk barang non-serial tidak berubah.
  async function fetchSerialNumbersForItem(it: RawPengajuanBarangItem, gudangId: number): Promise<string[] | undefined> {
    if (!it.barang?.isSerialized) return undefined;
    try {
      const res = await barangSerialApi.list({
        barangId: String(it.barangId),
        gudangId: String(gudangId),
        status: 'tersedia',
        pageSize: 200,
      });
      return res.data.map((unit) => unit.serialNumber);
    } catch {
      return undefined;
    }
  }

  async function handlePrint(row: RawPengajuanBarang): Promise<void> {
    // Jenis "template": "mencetak" berarti mengunduh berkas formulir asli
    // (PDF/DOC/DOCX) apa adanya — sistem tidak tahu struktur internalnya
    // sehingga tidak mungkin dibuatkan layout jsPDF khusus seperti 3 jenis
    // lain di bawah.
    if (row.jenis === 'template') {
      if (!row.template) {
        toast.error('Data formulir tidak lengkap, coba muat ulang halaman.');
        return;
      }
      try {
        await pengajuanTemplatesApi.download(row.template);
      } catch (err) {
        toast.error(friendlyError(err, 'Gagal mengunduh berkas formulir.'));
      }
      return;
    }

    const meta = GENERIC_STATUS_META[row.status] ?? { label: row.status };
    const jenisRow: 'masuk' | 'keluar' | 'rusak' = row.jenis === 'masuk' || row.jenis === 'rusak' ? row.jenis : 'keluar';
    const items = await Promise.all(
      (row.items ?? []).map(async (it) => ({
        namaBarang: it.barang?.nama ?? `Barang #${it.barangId}`,
        sku: it.barang?.kodeBarang,
        merek: it.barang?.merek,
        tipe: it.barang?.tipe,
        qty: it.qty,
        satuan: it.barang?.satuan?.singkatan ?? it.barang?.satuan?.nama,
        serialNumbers: await fetchSerialNumbersForItem(it, row.gudangId),
      })),
    );
    printPengajuanBarang({
      jenis: jenisRow,
      nomorPengajuan: row.nomorPengajuan,
      tanggal: formatDate(row.tanggal),
      gudangNama: row.gudang?.nama ?? '-',
      gudangLabel: JENIS_GUDANG_LABEL[jenisRow],
      keperluan: row.keperluan,
      statusLabel: meta.label,
      items,
      pelaporNama: row.pengaju?.fullName,
      generatedBy: user?.fullName,
    });
  }

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkChange(selectedRows: RawPengajuanBarang[]): Promise<void> {
    if (!isBulkMode) {
      toast('Aktifkan "Modify" dulu untuk memilih satu pengajuan yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Pilih tepat SATU pengajuan untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  async function handleBulkDelete(selectedRows: RawPengajuanBarang[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Aktifkan "Modify" dulu, lalu pilih satu atau beberapa pengajuan yang mau dihapus.');
      return;
    }
    const nonDeletable = selectedRows.filter((r) => r.status !== 'diajukan');
    if (nonDeletable.length > 0) {
      toast.error('Hanya pengajuan berstatus "Menunggu Persetujuan" yang bisa dihapus — batalkan pilihan pada pengajuan yang sudah diproses.');
      return;
    }
    const ok = await confirm({
      title: 'Hapus Pengajuan Terpilih',
      message: `Apakah yakin ingin menghapus ${selectedRows.length} pengajuan terpilih?`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => pengajuanApi.remove(String(r.id))));
      toast.success(`${selectedRows.length} pengajuan berhasil dihapus.`);
      setSelectedIds(new Set());
      await mutate();
      await mutateSummary();
    } catch (err) {
      toast.error(friendlyError(err, 'Sebagian/semua pengajuan gagal dihapus.'));
    }
  }

  async function handleRowAction(action: TableRowAction): Promise<void> {
    const selectedRows = rows.filter((r) => selectedIds.has(String(r.id)));
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
      default:
        return;
    }
  }

  const columns: DataTableColumn<RawPengajuanBarang>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: RawPengajuanBarang) => (
              <input
                type="checkbox"
                checked={selectedIds.has(String(row.id))}
                onChange={() => toggleSelected(String(row.id))}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<RawPengajuanBarang>,
        ]
      : []),
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'code', header: 'Nomor Pengajuan', render: (row) => row.nomorPengajuan },
    { key: 'jenis', header: 'Jenis', render: renderPengajuanJenisBadge },
    { key: 'gudang', header: 'Gudang', render: (row) => row.gudang?.nama ?? '-' },
    { key: 'keperluan', header: 'Keperluan', render: (row) => row.keperluan },
    { key: 'items', header: 'Barang / Formulir', render: renderPengajuanItemsCell },
    { key: 'pengaju', header: 'Diajukan Oleh', render: (row) => row.pengaju?.fullName ?? '-' },
    { key: 'status', header: 'Status', render: renderPengajuanStatusBadge },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <PengajuanRowActions
          row={row}
          currentUserId={user?.id}
          canApprove={canApprove}
          onDetail={() => setDetailDoc(row)}
          onPrint={() => handlePrint(row)}
          onSetujui={() => openProsesModal(row, 'setujui')}
          onTolak={() => openProsesModal(row, 'tolak')}
          onDelete={() => handleDelete(row)}
        />
      ),
    },
  ];

  return (
    <PageShell title="Pengajuan Barang" breadcrumb="Pengelolaan / Pengajuan Barang">
      <StatsRow
        stats={[
          {
            id: 'diajukan',
            label: 'Menunggu Persetujuan',
            value: summary?.totalDiajukan ?? 0,
          },
          { id: 'disetujui', label: 'Disetujui', value: summary?.totalDisetujui ?? 0 },
          { id: 'ditolak', label: 'Ditolak', value: summary?.totalDitolak ?? 0 },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PengajuanJenisTabs value={jenisFilter} onChange={setJenisFilter} />
        <TemplateDropdownButton
          templates={templates}
          isLoadingTemplates={isLoadingTemplates}
          isStaff={isStaff}
          onSelectTemplate={openCreateModalForTemplate}
          onUploadClick={() => setIsTemplateUploadOpen(true)}
          onDeleteTemplate={handleDeleteTemplate}
        />
      </div>

      <DataTable
        title="Daftar Pengajuan Barang"
        description={
          isBulkMode
            ? `Mode Modify aktif ${selectedIds.size} dipilih. Silakan pilih data per baris lalu gunakan Change/Delete di atas.`
            : 'Pengajuan barang masuk, keluar, laporan barang rusak, maupun pengajuan berbasis formulir template (mis. cuti, izin, dsb.) — semuanya perlu persetujuan (mis. Bagian General Affairs) sebelum diproses.'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        isLoading={isLoading}
        onRowAction={handleRowAction}
        module="pengajuan_barang"
        visibleActions={['add', 'change', 'delete', 'modify']}
        serverPagination={serverPagination}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Semua Status"
              options={STATUS_FILTER_OPTIONS}
              className="w-48"
            />
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
            <TableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Cari nomor pengajuan......" />
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        title={modalTitle(editingId, jenis)}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {editingId ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {jenis === 'template' ? (
            <div className="rounded-md border border-borderSoft bg-neutralBg/40 px-3 py-2 text-sm">
              <span className="block text-xs font-medium text-textMuted">Formulir</span>
              <span className="font-semibold text-text">{templateNama || '-'}</span>
            </div>
          ) : (
            <Select
              label="Jenis Pengajuan"
              value={jenis}
              onChange={(e) => setJenis(e.target.value as PengajuanBarangJenis)}
              options={JENIS_CREATE_OPTIONS}
            />
          )}
          <Input label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <Select
          label={JENIS_GUDANG_LABEL[jenis]}
          value={gudangId}
          onChange={(e) => setGudangId(e.target.value)}
          placeholder="Pilih gudang"
          options={(gudangList?.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
        />
        <Input
          label="Keperluan"
          value={keperluan}
          onChange={(e) => setKeperluan(e.target.value)}
          placeholder={jenis === 'template' ? 'Jelaskan detail pengajuan Anda' : 'mis. Pemasangan baru pelanggan Blok A'}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nama Pencatat/Gudang (opsional)"
            value={namaPencatat}
            onChange={(e) => setNamaPencatat(e.target.value)}
            placeholder="Nama yang akan tanda tangan di dokumen"
          />
          <Input
            label="Jabatan (opsional)"
            value={jabatanPencatat}
            onChange={(e) => setJabatanPencatat(e.target.value)}
            placeholder="mis. Staf Gudang"
          />
        </div>

        {jenis === 'template' ? null : (
          <PengajuanItemRowsEditor
            itemRows={itemRows}
            barangOptions={(barangList?.data ?? []).map((b) => {
              const details = [b.merek, b.tipe].filter(Boolean).join(' ');
              const detailsText = details ? ` (${details})` : '';
              return { label: `${b.sku} — ${b.name}${detailsText}`, value: b.id };
            })}
            onAddRow={() => setItemRows((prev) => [...prev, { ...EMPTY_ITEM_ROW, key: nextRowKey() }])}
            onUpdateRow={updateItemRow}
            onRemoveRow={removeItemRow}
            onQuickAdd={setQuickAddForRowIndex}
          />
        )}
      </Modal>

      <PengajuanProsesModal
        target={prosesTarget}
        namaGa={namaGa}
        onNamaGaChange={setNamaGa}
        jabatanGa={jabatanGa}
        onJabatanGaChange={setJabatanGa}
        catatanProses={catatanProses}
        onCatatanProsesChange={setCatatanProses}
        isSaving={isProsesSaving}
        onClose={() => setProsesTarget(null)}
        onSubmit={submitProses}
      />

      <PengajuanDetailModal
        doc={detailDoc}
        currentUserId={user?.id}
        onClose={() => setDetailDoc(null)}
        onEdit={(doc) => {
          openEditModal(doc);
          setDetailDoc(null);
        }}
        onPrint={handlePrint}
      />

      <QuickAddItemModal
        isOpen={quickAddForRowIndex !== null}
        onClose={() => setQuickAddForRowIndex(null)}
        onCreated={(item) => {
          if (quickAddForRowIndex === null) return;
          updateItemRow(quickAddForRowIndex, { barangId: item.id });
          void mutateBarangList();
        }}
        kategoriList={kategoriList}
        satuanList={satuanList}
      />

      <TemplateUploadModal
        isOpen={isTemplateUploadOpen}
        onClose={() => setIsTemplateUploadOpen(false)}
        onUploaded={() => {
          void mutateTemplates();
        }}
      />
    </PageShell>
  );
}
