import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportColumn } from '@/lib/utils/export-csv';

export interface PdfExportOptions {

  title: string;

  subtitle?: string;

  description?: string;

  generatedBy?: string;

  fileName?: string;
}

const PAGE_MARGIN = 40;

function slugifyForFileName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function buildPdfDoc<T>(rows: T[], columns: ExportColumn<T>[], options: PdfExportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setProperties({ title: slugifyForFileName(options.fileName ?? options.title) });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('WMS-RSD', PAGE_MARGIN, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Sistem Pengelolaan Gudang & Inventaris', PAGE_MARGIN, cursorY + 14);

  const printedAt = new Date().toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  doc.setFontSize(8);
  doc.text(`Dicetak: ${printedAt}`, pageWidth - PAGE_MARGIN, cursorY, { align: 'right' });
  if (options.generatedBy) {
    doc.text(`Oleh: ${options.generatedBy}`, pageWidth - PAGE_MARGIN, cursorY + 12, { align: 'right' });
  }

  cursorY += 30;
  doc.setDrawColor(220, 220, 220);
  doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
  cursorY += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(options.title, PAGE_MARGIN, cursorY);
  cursorY += 16;

  if (options.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(options.subtitle, PAGE_MARGIN, cursorY);
    cursorY += 16;
  }

  if (options.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    const wrapped = doc.splitTextToSize(options.description, pageWidth - PAGE_MARGIN * 2);
    doc.text(wrapped, PAGE_MARGIN, cursorY);
    cursorY += wrapped.length * 12 + 6;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Total data: ${rows.length} baris`, PAGE_MARGIN, cursorY);
  cursorY += 12;

  const LONG_TEXT_HEADER_PATTERN = /serial|catatan|keterangan|alasan|deskripsi|note/i;
  const columnStyles: Record<number, { cellWidth: number }> = {};
  columns.forEach((c, index) => {
    if (LONG_TEXT_HEADER_PATTERN.test(c.header)) {
      columnStyles[index] = { cellWidth: 130 };
    }
  });

  autoTable(doc, {
    startY: cursorY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.accessor(row) ?? '-'))),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [40, 40, 40], overflow: 'linebreak' },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles,
    horizontalPageBreak: true,
    theme: 'grid',
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Halaman ${doc.getCurrentPageInfo().pageNumber} dari ${pageCount}`,
        pageWidth - PAGE_MARGIN,
        pageHeight - 20,
        { align: 'right' },
      );
      doc.text('WMS-RSD — dokumen ini dihasilkan otomatis oleh sistem.', PAGE_MARGIN, pageHeight - 20);
    },
  });

  return doc;
}

export function exportRowsToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: PdfExportOptions,
): void {
  const doc = buildPdfDoc(rows, columns, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function printRowsToPdf<T>(rows: T[], columns: ExportColumn<T>[], options: PdfExportOptions): void {
  const doc = buildPdfDoc(rows, columns, options);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
