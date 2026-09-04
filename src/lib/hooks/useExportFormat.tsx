'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Modal } from '@/component/ui/Modal';
import { useAuth } from '@/auth/AuthContext';
import { exportRowsToExcel } from '@/lib/utils/export-excel';
import { exportRowsToPdf, type PdfExportOptions } from '@/lib/utils/export-pdf';
import type { ExportColumn } from '@/lib/utils/export-csv';
import { applyGranularity, type ExportGranularity, type GranularityConfig } from '@/lib/utils/period-grouping';

interface PendingExport<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filenameBase: string;
  pdf: Omit<PdfExportOptions, 'generatedBy'>;
  granularityConfig?: GranularityConfig<T>;
}

interface UseExportFormatResult {

  requestExport: <T>(
    rows: T[],
    columns: ExportColumn<T>[],
    filenameBase: string,
    pdf: Omit<PdfExportOptions, 'generatedBy'>,
    granularityConfig?: GranularityConfig<T>,
  ) => void;

  dialog: React.JSX.Element;
}

const GRANULARITY_OPTIONS: { value: ExportGranularity; label: string; hint: string }[] = [
  { value: 'harian', label: 'Harian', hint: 'Rincian per baris, tanggal lengkap (mis. 1 September 2026)' },
  { value: 'bulanan', label: 'Bulanan', hint: 'Dikelompokkan per bulan, dijumlahkan (mis. Agustus 2026)' },
];

export function useExportFormat(): UseExportFormatResult {
  const { user } = useAuth();

  const [pending, setPending] = useState<PendingExport<unknown> | null>(null);
  const [granularity, setGranularity] = useState<ExportGranularity>('harian');

  function requestExport<T>(
    rows: T[],
    columns: ExportColumn<T>[],
    filenameBase: string,
    pdf: Omit<PdfExportOptions, 'generatedBy'>,
    granularityConfig?: GranularityConfig<T>,
  ): void {
    setGranularity('harian');
    // PendingExport<T> disimpan sebagai PendingExport<unknown> karena state
    // ini dipakai bergantian oleh menu-menu dengan bentuk data (T) yang
    // berbeda-beda — aman karena rows/columns/granularityConfig di atas
    // sudah konsisten satu sama lain (semuanya bertipe T yang sama).
    setPending({ rows, columns, filenameBase, pdf, granularityConfig } as unknown as PendingExport<unknown>);
  }

  function handleChoose(format: 'pdf' | 'excel'): void {
    if (!pending) return;
    const prepared: { rows: unknown[]; columns: ExportColumn<unknown>[] } = pending.granularityConfig
      ? (applyGranularity(pending.rows, pending.columns, granularity, pending.granularityConfig) as {
          rows: unknown[];
          columns: ExportColumn<unknown>[];
        })
      : { rows: pending.rows, columns: pending.columns };
    const filenameSuffix = pending.granularityConfig && granularity === 'bulanan' ? '-bulanan' : '';
    const filenameBase = `${pending.filenameBase}${filenameSuffix}`;

    if (format === 'excel') {
      exportRowsToExcel(prepared.rows, prepared.columns, filenameBase);
    } else {
      exportRowsToPdf(prepared.rows, prepared.columns, filenameBase, {
        ...pending.pdf,
        generatedBy: user?.fullName,
      });
    }
    setPending(null);
  }

  const dialog = (
    <Modal isOpen={pending !== null} title="Pilih Format Export" onClose={() => setPending(null)}>
      <p className="text-sm text-textMuted">
        Pilih format file untuk data &quot;{pending?.pdf.title ?? ''}&quot; ({pending?.rows.length ?? 0} baris).
      </p>
      {pending?.granularityConfig ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-textMuted">Tampilkan data</p>
          <div className="grid grid-cols-2 gap-2">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGranularity(opt.value)}
                className={`rounded-md border p-2.5 text-left text-xs transition-colors ${
                  granularity === opt.value
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-borderSoft text-textMuted hover:border-accent/50'
                }`}
              >
                <span className="block font-semibold">{opt.label}</span>
                <span className="block text-[11px] leading-snug text-textMuted">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleChoose('pdf')}
          className="flex flex-col items-center gap-2 rounded-md border border-borderSoft p-4 text-center transition-colors hover:border-accent hover:bg-surfaceAlt"
        >
          <FileText className="h-6 w-6 text-dangerText" />
          <span className="text-sm font-semibold text-text">PDF</span>
          <span className="text-xs text-textMuted">Ukuran A4, siap cetak</span>
        </button>
        <button
          type="button"
          onClick={() => handleChoose('excel')}
          className="flex flex-col items-center gap-2 rounded-md border border-borderSoft p-4 text-center transition-colors hover:border-accent hover:bg-surfaceAlt"
        >
          <FileSpreadsheet className="h-6 w-6 text-successText" />
          <span className="text-sm font-semibold text-text">Excel</span>
          <span className="text-xs text-textMuted">File .xlsx, siap diolah</span>
        </button>
      </div>
    </Modal>
  );

  return { requestExport, dialog };
}
