import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportColumn } from '@/lib/utils/export-csv';

export interface PdfExportOptions {
  /** Judul laporan, mis. "Rekap Data Gudang — Kelola Barang". */
  title: string;
  /** Anak judul singkat, mis. breadcrumb halaman ("Pengelolaan / Kelola Barang"). */
  subtitle?: string;
  /** 1–3 kalimat penjelasan isi laporan — wajib ada di rekap gudang, tampil
   * di bawah judul sebelum tabel data (mis. cakupan data, filter yang aktif). */
  description?: string;
  /** Nama user yang membuat laporan (diisi dari sesi login). */
  generatedBy?: string;
}

const PAGE_MARGIN = 40; // pt

/**
 * Bangun dokumen jsPDF A4 mengikuti format baku rekap data gudang WMS-RSD:
 * kop (nama aplikasi + judul laporan), blok penjelasan singkat, metadata
 * (tanggal cetak & dibuat oleh), lalu tabel data. Dipakai bersama oleh
 * exportRowsToPdf (unduh file) dan printRowsToPdf (buka dialog cetak
 * browser) supaya kedua alur menghasilkan dokumen yang identik.
 */
function buildPdfDoc<T>(rows: T[], columns: ExportColumn<T>[], options: PdfExportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = PAGE_MARGIN;

  // --- Kop dokumen -----------------------------------------------------
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

  // --- Judul laporan -----------------------------------------------------
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

  // --- Blok penjelasan ---------------------------------------------------
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

  // --- Tabel data ----------------------------------------------------
  autoTable(doc, {
    startY: cursorY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.accessor(row) ?? '-'))),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [40, 40, 40] },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
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

/**
 * Ekspor baris tabel apa pun ke PDF ukuran A4 (unduh file) — dipakai
 * bergantian dengan exportRowsToExcel lewat pilihan format di tombol
 * Export (lihat useExportFormat.tsx).
 */
export function exportRowsToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: PdfExportOptions,
): void {
  const doc = buildPdfDoc(rows, columns, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Sama seperti exportRowsToPdf, tapi langsung membuka dialog cetak browser
 * (window.print) alih-alih mengunduh file — dipakai tombol "Print" di
 * TableRowActionBar. Dokumen dibuka di tab baru supaya dialog cetak
 * browser tidak menutupi halaman WMS yang sedang dibuka.
 */
export function printRowsToPdf<T>(rows: T[], columns: ExportColumn<T>[], options: PdfExportOptions): void {
  const doc = buildPdfDoc(rows, columns, options);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
