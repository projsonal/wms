import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportColumn } from '@/lib/utils/export-csv';
import { computeAutoTableColumnStyles, type AutoTableColumnStyle } from '@/lib/utils/pdf-column-width';

export interface PdfChartImage {
  dataUrl: string;
  /** Rasio tinggi/lebar gambar asli (mis. 240/600) — dipakai untuk menjaga proporsi saat digambar ulang di PDF. */
  aspectRatio: number;
  /** Judul kecil di atas gambar chart, opsional. */
  caption?: string;
}

export interface PdfExportOptions {

  title: string;

  subtitle?: string;

  description?: string;

  generatedBy?: string;

  fileName?: string;

  /**
   * Paragraf naratif tambahan (bukan cuma tabel mentah) — ditampilkan setelah
   * description, sebelum ringkasan "Total data". Tiap string = satu paragraf.
   */
  narrative?: string[];

  /** Gambar hasil "Analisa Data" (chart) untuk disisipkan sebelum tabel. */
  chartImage?: PdfChartImage;

  /**
   * Blok konfirmasi tanda tangan kerja gudang di akhir dokumen. Default true
   * (semua dokumen "Rekap Data ..." memakainya) — set false untuk dokumen
   * yang sudah punya blok tanda tangannya sendiri.
   */
  showConfirmationBlock?: boolean;
}

const PAGE_MARGIN = 40;
const CONFIRMATION_BLOCK_HEIGHT = 110;

function slugifyForFileName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

// Menyusutkan lebar kolom yang sudah dihitung untuk tabel selebar penuh
// (computeAutoTableColumnStyles) supaya proporsional muat di lebar `targetWidth`
// yang lebih sempit — dipakai saat tabel dirender jadi 2 kolom berdampingan
// (lihat renderBodyTable). halign (rata kanan utk angka) tetap dipertahankan.
function scaleColumnStyles(
  styles: Record<number, AutoTableColumnStyle>,
  targetWidth: number,
  minWidth = 26,
): Record<number, AutoTableColumnStyle> {
  const total = Object.values(styles).reduce((sum, c) => sum + c.cellWidth, 0);
  if (total <= 0) {
    return styles;
  }
  const ratio = targetWidth / total;
  const scaled: Record<number, AutoTableColumnStyle> = {};
  Object.entries(styles).forEach(([key, value]) => {
    scaled[Number(key)] = { ...value, cellWidth: Math.max(minWidth, Math.floor(value.cellWidth * ratio)) };
  });
  return scaled;
}

function renderHeaderBrand(doc: jsPDF, pageWidth: number, generatedBy?: string): number {
  const cursorY = PAGE_MARGIN;
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
  if (generatedBy) {
    doc.text(`Oleh: ${generatedBy}`, pageWidth - PAGE_MARGIN, cursorY + 12, { align: 'right' });
  }

  let nextY = cursorY + 30;
  doc.setDrawColor(220, 220, 220);
  doc.line(PAGE_MARGIN, nextY, pageWidth - PAGE_MARGIN, nextY);
  nextY += 24;
  return nextY;
}

// Judul "REKAP DATA ..." SELALU dirata-tengah & huruf besar semua — menyamakan
// gaya semua dokumen "Rekap Data" di seluruh menu dengan template Kelola
// Barang yang jadi acuan, tanpa perlu mengubah string judul di tiap pemanggil.
function renderTitleBlock(doc: jsPDF, pageWidth: number, options: PdfExportOptions, startY: number): number {
  let cursorY = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(options.title.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 16;

  if (options.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(options.subtitle, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 16;
  }
  return cursorY;
}

function renderDescriptionAndNarrative(doc: jsPDF, pageWidth: number, options: PdfExportOptions, startY: number): number {
  let cursorY = startY;
  const paragraphs = [
    ...(options.description ? [options.description] : []),
    ...(options.narrative ?? []),
  ];
  paragraphs.forEach((paragraph) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    const wrapped = doc.splitTextToSize(paragraph, pageWidth - PAGE_MARGIN * 2);
    doc.text(wrapped, PAGE_MARGIN, cursorY);
    cursorY += wrapped.length * 12 + 6;
  });
  return cursorY;
}

// Menyisipkan gambar chart "Analisa Data" (sudah dirender jadi PNG data URL
// di sisi pemanggil, lihat lib/utils/chart-snapshot.ts) sebelum tabel data —
// lebarnya disesuaikan penuh ke area cetak, tingginya proporsional dari
// aspectRatio supaya tidak gepeng/melar.
function renderChartImage(doc: jsPDF, pageWidth: number, pageHeight: number, chart: PdfChartImage, startY: number): number {
  let cursorY = startY;
  const maxWidth = pageWidth - PAGE_MARGIN * 2;
  const imgWidth = Math.min(maxWidth, 380);
  const imgHeight = imgWidth * chart.aspectRatio;

  if (cursorY + imgHeight + 30 > pageHeight - PAGE_MARGIN) {
    doc.addPage();
    cursorY = PAGE_MARGIN;
  }

  if (chart.caption) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(chart.caption, PAGE_MARGIN, cursorY);
    cursorY += 14;
  }

  const imgX = (pageWidth - imgWidth) / 2;
  try {
    doc.addImage(chart.dataUrl, 'PNG', imgX, cursorY, imgWidth, imgHeight, undefined, 'FAST');
    cursorY += imgHeight + 16;
  } catch {
    // Gagal menyisipkan gambar (mis. data URL rusak) — jangan gagalkan
    // seluruh dokumen, cukup lewati bagian chart-nya.
  }
  return cursorY;
}

interface BodyTableResult {
  finalY: number;
}

const TWO_COLUMN_MAX_COLUMNS = 6;
const EST_ROW_HEIGHT = 21;
const EST_HEADER_HEIGHT = 24;
const SAFETY_FACTOR = 0.92;

function estimatePagesNeeded(rowCount: number, availableHeight: number): number {
  const usable = Math.max(1, availableHeight * SAFETY_FACTOR - EST_HEADER_HEIGHT);
  return Math.max(1, Math.ceil((rowCount * EST_ROW_HEIGHT) / usable));
}

// Tabel data utama — otomatis dirender jadi 2 kolom berdampingan (kiri lalu
// kanan, masing-masing separuh baris) kalau: (a) tabel 1-kolom-penuh akan
// meluber ke lebih dari 1 halaman, DAN (b) versi 2-kolom diperkirakan muat
// dalam 1 halaman, DAN (c) jumlah kolomnya cukup sedikit supaya 2 salinan
// berdampingan tidak terlalu sempit untuk dibaca. Kalau salah satu syarat itu
// tidak terpenuhi (atau ada apa pun yang gagal saat mencoba), jatuh balik ke
// tabel 1-kolom biasa yang boleh lanjut ke halaman berikutnya seperti biasa —
// ini SENGAJA supaya percobaan tata-letak 2-kolom tidak pernah membuat data
// gagal tercetak sama sekali.
function renderBodyTable(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  headers: string[],
  bodyRows: string[][],
  columnStyles: Record<number, AutoTableColumnStyle>,
  startY: number,
): BodyTableResult {
  const availableHeight = pageHeight - startY - PAGE_MARGIN - 40;
  const singlePageEstimate = estimatePagesNeeded(bodyRows.length, availableHeight);
  const canTryTwoColumn =
    headers.length <= TWO_COLUMN_MAX_COLUMNS && bodyRows.length >= 8 && singlePageEstimate > 1;

  if (canTryTwoColumn) {
    const half = Math.ceil(bodyRows.length / 2);
    const twoColumnEstimate = estimatePagesNeeded(half, availableHeight);
    if (twoColumnEstimate <= 1) {
      try {
        const gap = 18;
        const halfWidth = (pageWidth - PAGE_MARGIN * 2 - gap) / 2;
        const leftStyles = scaleColumnStyles(columnStyles, halfWidth);
        const leftRows = bodyRows.slice(0, half);
        const rightRows = bodyRows.slice(half);
        const sharedStyles = {
          font: 'helvetica' as const,
          fontSize: 7.5,
          cellPadding: 4,
          textColor: [40, 40, 40] as [number, number, number],
          overflow: 'linebreak' as const,
        };
        const sharedHeadStyles = { fillColor: [180, 83, 9] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const };
        const sharedAltStyles = { fillColor: [250, 245, 240] as [number, number, number] };

        let leftFinalY = startY;
        autoTable(doc, {
          startY,
          margin: { left: PAGE_MARGIN, right: pageWidth - PAGE_MARGIN - halfWidth },
          tableWidth: halfWidth,
          head: [headers],
          body: leftRows,
          styles: sharedStyles,
          headStyles: sharedHeadStyles,
          alternateRowStyles: sharedAltStyles,
          columnStyles: leftStyles,
          horizontalPageBreak: false,
          theme: 'grid',
          didDrawPage: (hook) => {
            leftFinalY = hook.cursor?.y ?? leftFinalY;
          },
        });

        let rightFinalY = startY;
        if (rightRows.length > 0) {
          autoTable(doc, {
            startY,
            margin: { left: PAGE_MARGIN + halfWidth + gap, right: PAGE_MARGIN },
            tableWidth: halfWidth,
            head: [headers],
            body: rightRows,
            styles: sharedStyles,
            headStyles: sharedHeadStyles,
            alternateRowStyles: sharedAltStyles,
            columnStyles: leftStyles,
            horizontalPageBreak: false,
            theme: 'grid',
            didDrawPage: (hook) => {
              rightFinalY = hook.cursor?.y ?? rightFinalY;
            },
          });
        }

        // Kalau ternyata salah satu kolom meluber ke halaman baru juga
        // (perkiraan meleset), dokumennya tetap valid — cuma tidak
        // seideal target "1 halaman", jadi tetap dianggap berhasil.
        return { finalY: Math.max(leftFinalY, rightFinalY) };
      } catch {
        // Jatuh balik ke tabel 1-kolom di bawah.
      }
    }
  }

  let finalY = startY;
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [headers],
    body: bodyRows,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [40, 40, 40], overflow: 'linebreak' },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles,
    horizontalPageBreak: true,
    theme: 'grid',
    didDrawPage: (hook) => {
      finalY = hook.cursor?.y ?? finalY;
    },
  });
  return { finalY };
}

// Blok konfirmasi penutup — menegaskan dokumen ini hasil kerja pengelolaan
// gudang/inventaris yang resmi (bukan cuma dump tabel), plus kolom tanda
// tangan ringkas supaya bisa dipakai sebagai bukti fisik kalau diperlukan.
function renderConfirmationBlock(doc: jsPDF, pageWidth: number, pageHeight: number, startY: number, generatedBy?: string): void {
  let cursorY = startY + 14;
  if (cursorY + CONFIRMATION_BLOCK_HEIGHT > pageHeight - PAGE_MARGIN) {
    doc.addPage();
    cursorY = PAGE_MARGIN;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const confirmation = doc.splitTextToSize(
    'Dokumen ini merupakan rekapitulasi resmi hasil pengelolaan gudang dan inventaris, disusun sesuai ' +
      'prosedur kerja pergudangan yang berlaku, dan datanya sesuai dengan sistem pada saat dicetak.',
    pageWidth - PAGE_MARGIN * 2,
  );
  doc.text(confirmation, PAGE_MARGIN, cursorY);
  cursorY += confirmation.length * 11 + 14;

  const boxWidth = (pageWidth - PAGE_MARGIN * 2 - 20) / 2;
  const boxHeight = 64;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + boxWidth + 20;

  doc.setDrawColor(210, 210, 210);
  doc.rect(leftX, cursorY, boxWidth, boxHeight);
  doc.rect(rightX, cursorY, boxWidth, boxHeight);

  function drawBox(x: number, title: string, prefill?: string): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(title, x + 10, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Tanda tangan & nama:', x + 10, cursorY + 28);
    doc.setDrawColor(170, 170, 170);
    doc.line(x + 10, cursorY + boxHeight - 14, x + boxWidth - 10, cursorY + boxHeight - 14);
    if (prefill) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(prefill, x + 10, cursorY + boxHeight - 18);
    }
  }

  drawBox(leftX, 'Dibuat oleh', generatedBy);
  drawBox(rightX, 'Diperiksa/Disetujui oleh');
}

function renderPageFooters(doc: jsPDF, pageWidth: number, pageHeight: number): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 20, { align: 'right' });
    doc.text('WMS-RSD — dokumen ini dihasilkan otomatis oleh sistem.', PAGE_MARGIN, pageHeight - 20);
  }
}

function buildPdfDoc<T>(rows: T[], columns: ExportColumn<T>[], options: PdfExportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setProperties({ title: slugifyForFileName(options.fileName ?? options.title) });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let cursorY = renderHeaderBrand(doc, pageWidth, options.generatedBy);
  cursorY = renderTitleBlock(doc, pageWidth, options, cursorY);
  cursorY = renderDescriptionAndNarrative(doc, pageWidth, options, cursorY);

  if (options.chartImage) {
    cursorY = renderChartImage(doc, pageWidth, pageHeight, options.chartImage, cursorY);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Total data: ${rows.length} baris`, PAGE_MARGIN, cursorY);
  cursorY += 12;

  const headers = columns.map((c) => c.header);
  const bodyRows = rows.map((row) => columns.map((c) => String(c.accessor(row) ?? '-')));
  // Kolom dengan value pendek (mis. Stok yang cuma angka) dirapatkan sesuai
  // isinya; kolom dengan value panjang (mis. alamat/keterangan) dapat lebar
  // tetap supaya teksnya turun ke baris berikutnya (wrap) rapi, bukan
  // melebarkan kolom mengikuti isi terpanjang. Lihat pdf-column-width.ts.
  const columnStyles = computeAutoTableColumnStyles(doc, headers, bodyRows);

  const { finalY } = renderBodyTable(doc, pageWidth, pageHeight, headers, bodyRows, columnStyles, cursorY);

  if (options.showConfirmationBlock !== false) {
    renderConfirmationBlock(doc, pageWidth, pageHeight, finalY, options.generatedBy);
  }

  renderPageFooters(doc, pageWidth, pageHeight);

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
