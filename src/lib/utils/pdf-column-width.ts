import type { jsPDF } from 'jspdf';

// Menghitung lebar kolom tabel PDF (jspdf-autotable) berdasarkan isi datanya,
// bukan cuma header — dipakai bareng oleh semua generator dokumen PDF di app
// ini (export-pdf.ts untuk "Rekap Data ..." semua menu, print-pengajuan.ts
// untuk dokumen Pengajuan Barang) supaya tampilannya konsisten:
//
// - Value pendek (angka seperti Stok, kode singkat seperti SKU/Status) dapat
//   lebar kolom yang pas-pasan sesuai isinya (diukur dari lebar teks
//   sebenarnya lewat jsPDF, bukan tebakan), tidak melar mengikuti header.
// - Value panjang (alamat, keterangan, nama yang panjang, dsb) dapat lebar
//   kolom tetap yang cukup lega, lalu teksnya turun ke baris berikutnya
//   (wrap) rapi rata kiri di dalam kolom itu — bukan melebarkan kolom sampai
//   satu baris penuh seperti perilaku default autoTable.
//
// Catatan: fontSize & cellPadding di sini HARUS senilai dengan `styles`
// autoTable yang dipakai di pemanggilnya, supaya perkiraan lebarnya akurat.

export interface AutoTableColumnStyle {
  cellWidth: number;
  halign?: 'left' | 'center' | 'right';
}

export interface ColumnWidthOptions {
  /** Harus sama dengan `styles.fontSize` pada autoTable. Default 8.5. */
  fontSize?: number;
  /** Harus sama dengan `styles.cellPadding` pada autoTable. Default 5. */
  cellPadding?: number;
  /** Lebar minimum kolom (pt). Default 32. */
  minWidth?: number;
  /** Batas atas lebar untuk kolom "pendek" (pt) — cukup buat kode semacam SKU tanpa wrap. Default 115. */
  shortMaxWidth?: number;
  /** Lebar tetap yang diberikan ke kolom "teks panjang" supaya bisa wrap (pt). Default 150. */
  longTextWidth?: number;
  /** Panjang karakter minimal salah satu value supaya kolomnya dianggap "teks panjang". Default 22. */
  longValueThreshold?: number;
  /** Index kolom yang gaya/lebarnya mau dipertahankan manual (tidak dihitung ulang). */
  overrides?: Record<number, AutoTableColumnStyle>;
}

const NUMERIC_VALUE_PATTERN = /^-?[\d.,\sRp%]+$/;

function isNumericLikeColumn(values: string[]): boolean {
  const nonEmpty = values.filter((v) => v !== '' && v !== '-');
  if (nonEmpty.length === 0) {
    return false;
  }
  return nonEmpty.every((v) => NUMERIC_VALUE_PATTERN.test(v));
}

// `doc` dipakai untuk mengukur lebar teks sebenarnya (font + ukuran yang
// sama seperti dipakai autoTable) lewat jsPDF.getTextWidth — jauh lebih
// akurat daripada menaksir dari jumlah karakter, dan menghindari kolom yang
// membungkus kata pendek secara tanggung (mis. "SKU" jadi terlalu sempit).
// Aman dipanggil sebelum autoTable(): hanya mengubah font/ukuran sementara
// untuk mengukur, dan autoTable akan mengeset font/ukurannya sendiri lagi
// saat benar-benar menggambar tabel.
export function computeAutoTableColumnStyles(
  doc: jsPDF,
  headers: string[],
  bodyRows: string[][],
  options: ColumnWidthOptions = {},
): Record<number, AutoTableColumnStyle> {
  const {
    fontSize = 8.5,
    cellPadding = 5,
    minWidth = 32,
    shortMaxWidth = 115,
    longTextWidth = 150,
    longValueThreshold = 22,
    overrides = {},
  } = options;

  const padding = cellPadding * 2;
  const styles: Record<number, AutoTableColumnStyle> = {};

  headers.forEach((header, index) => {
    if (overrides[index]) {
      styles[index] = overrides[index];
      return;
    }

    const values = bodyRows.map((row) => row[index] ?? '');
    const hasLongValue = values.some((v) => v.length >= longValueThreshold);

    if (hasLongValue) {
      styles[index] = { cellWidth: longTextWidth };
      return;
    }

    // Header dirender bold di headStyles, body dirender normal — ukur
    // masing-masing dengan font yang sesuai biar lebarnya presisi.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    const headerWidth = doc.getTextWidth(header);

    doc.setFont('helvetica', 'normal');
    const valuesWidth = values.reduce((max, v) => Math.max(max, doc.getTextWidth(v)), 0);

    const natural = Math.ceil(Math.max(headerWidth, valuesWidth) + padding);
    const cellWidth = Math.min(shortMaxWidth, Math.max(minWidth, natural));

    // Kolom yang isinya murni angka (atau angka + Rp/%/koma) dirapikan rata
    // kanan supaya enak dibaca sejajar — dicek dari isi barisnya, bukan
    // ditebak dari nama header.
    styles[index] = isNumericLikeColumn(values) ? { cellWidth, halign: 'right' } : { cellWidth };
  });

  return styles;
}
