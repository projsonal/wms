'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Modal } from '@/component/ui/Modal';
import { useAuth } from '@/auth/AuthContext';
import { exportRowsToExcel } from '@/lib/utils/export-excel';
import { exportRowsToPdf, type PdfExportOptions } from '@/lib/utils/export-pdf';
import type { ExportColumn } from '@/lib/utils/export-csv';

interface PendingExport<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filenameBase: string;
  pdf: Omit<PdfExportOptions, 'generatedBy'>;
}

interface UseExportFormatResult {

  requestExport: <T>(
    rows: T[],
    columns: ExportColumn<T>[],
    filenameBase: string,
    pdf: Omit<PdfExportOptions, 'generatedBy'>,
  ) => void;

  dialog: React.JSX.Element;
}

export function useExportFormat(): UseExportFormatResult {
  const { user } = useAuth();

  const [pending, setPending] = useState<PendingExport<any> | null>(null);

  function requestExport<T>(
    rows: T[],
    columns: ExportColumn<T>[],
    filenameBase: string,
    pdf: Omit<PdfExportOptions, 'generatedBy'>,
  ): void {
    setPending({ rows, columns, filenameBase, pdf });
  }

  function handleChoose(format: 'pdf' | 'excel'): void {
    if (!pending) return;
    if (format === 'excel') {
      exportRowsToExcel(pending.rows, pending.columns, pending.filenameBase);
    } else {
      exportRowsToPdf(pending.rows, pending.columns, pending.filenameBase, {
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
