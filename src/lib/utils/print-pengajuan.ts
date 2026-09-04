import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { computeAutoTableColumnStyles } from '@/lib/utils/pdf-column-width';

// Dokumen cetak Pengajuan Barang HANYA dipakai untuk 3 jenis yang terkait
// barang (masuk/keluar/rusak) — jenis "template" (formulir yang diunggah
// admin, menggantikan "Pengajuan ke Atasan") tidak lewat sini sama sekali:
// "mencetak"-nya berarti mengunduh berkas asli formulirnya apa adanya
// (lihat pengajuanTemplatesApi.download di lib/api/modules.ts), karena
// sistem tidak tahu struktur internal tiap formulir yang diunggah.
export type PengajuanCetakJenis = 'masuk' | 'keluar' | 'rusak';

export interface PengajuanPrintItem {
  namaBarang: string;
  sku?: string;
  merek?: string;
  tipe?: string;
  qty: number;
  satuan?: string;
  // Diisi cuma untuk barang yang isSerialized (punya nomor seri per unit) —
  // daftar nomor seri yang tersedia di gudang asal, dicetak sebagai tabel
  // tambahan di bawah tabel barang utama. Kosong/undefined = tidak
  // ditampilkan sama sekali.
  serialNumbers?: string[];
}

export interface PengajuanPrintData {
  jenis: PengajuanCetakJenis;
  nomorPengajuan: string;
  tanggal: string;
  gudangNama: string;
  gudangLabel?: string;
  keperluan: string;
  statusLabel: string;
  items: PengajuanPrintItem[];
  // Nama yang dicetak di paragraf pembuka dokumen Barang Rusak ("...saya
  // (nama) sebagai petugas Gudang telah melakukan pengecekan..."). Kalau
  // kosong, jatuh ke `generatedBy`, lalu ke garis titik-titik.
  pelaporNama?: string;
  generatedBy?: string;
}

const PAGE_MARGIN = 40;
const FIELD_LABEL_WIDTH = 110;
const SIGNATURE_BLOCK_HEIGHT = 140;

const JUDUL_DOKUMEN: Record<PengajuanCetakJenis, string> = {
  masuk: 'PENGAJUAN BARANG MASUK',
  keluar: 'PENGAJUAN BARANG KELUAR',
  rusak: 'PENGAJUAN BARANG RUSAK',
};

// Catatan kaki di bawah tabel — beda kalimat per jenis karena tindak lanjut
// operasionalnya beda (barang masuk/keluar dicatat di dokumennya masing-
// masing, barang rusak ditindaklanjuti lewat halaman Barang Rusak).
const CATATAN_KAKI: Record<PengajuanCetakJenis, (gudang: string) => string> = {
  masuk: (gudang) =>
    `Catatan: Mohon segera masukkan ke data Barang Masuk Gudang ${gudang} setelah pengecekan secara fisik selesai.`,
  keluar: (gudang) =>
    `Catatan: Mohon segera masukkan ke data Barang Keluar Gudang ${gudang} setelah barang diserahkan/diambil.`,
  rusak: (gudang) =>
    `Catatan: Mohon segera tindak lanjuti data Barang Rusak Gudang ${gudang} setelah pengecekan secara fisik selesai.`,
};

// Header tabel per jenis — Merek & Tipe ditambahkan di semua jenis (data
// diambil dari katalog Barang). "Keterangan" (dan "Tindak Lanjut" khusus
// Barang Rusak) sengaja dibiarkan KOSONG di setiap baris: dokumen ini
// dipakai staf gudang sebagai lembar kerja fisik, diisi tulis tangan saat
// pengecekan/serah-terima barang berlangsung — bukan diisi otomatis oleh
// sistem karena informasinya memang belum ada saat pengajuan dibuat/dicetak.
const BARANG_HEADER_COLUMNS = ['No', 'Kode Barang', 'Nama Barang', 'Merek', 'Tipe', 'Jumlah(Stok)', 'Satuan', 'Keterangan'];
const TABLE_HEADERS: Record<PengajuanCetakJenis, string[]> = {
  masuk: BARANG_HEADER_COLUMNS,
  keluar: BARANG_HEADER_COLUMNS,
  rusak: [...BARANG_HEADER_COLUMNS, 'Tindak Lanjut'],
};

function renderPageFooter(doc: jsPDF, pageWidth: number, pageHeight: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Halaman ${doc.getCurrentPageInfo().pageNumber} dari ${doc.getNumberOfPages()}`,
    pageWidth - PAGE_MARGIN,
    pageHeight - 20,
    { align: 'right' },
  );
  doc.text('WMS-RSD — dokumen ini dihasilkan otomatis oleh sistem.', PAGE_MARGIN, pageHeight - 20);
}

// Kop dokumen (nama sistem + kapan/oleh siapa dicetak) — dipertahankan apa
// adanya sesuai versi sebelumnya, tidak termasuk bagian yang diringkas.
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

  const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  doc.setFontSize(8);
  doc.text(`Dicetak: ${printedAt}`, pageWidth - PAGE_MARGIN, cursorY, { align: 'right' });
  if (generatedBy) {
    doc.text(`Oleh: ${generatedBy}`, pageWidth - PAGE_MARGIN, cursorY + 12, { align: 'right' });
  }

  const lineY = cursorY + 30;
  doc.setDrawColor(220, 220, 220);
  doc.line(PAGE_MARGIN, lineY, pageWidth - PAGE_MARGIN, lineY);
  return lineY + 24;
}

// Judul rata tengah + baris field label:nilai yang diringkas (gaya "Label :
// Nilai" polos, bukan blok berwarna) — mengikuti format formulir cetak yang
// sudah dipakai gudang secara manual selama ini. Barang Rusak tidak punya
// baris "Keperluan" (digantikan paragraf pembuka di bawahnya).
function renderJudulDanField(doc: jsPDF, data: PengajuanPrintData, startY: number, pageWidth: number): number {
  let cursorY = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(JUDUL_DOKUMEN[data.jenis], pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 28;

  const fieldRows: [string, string][] = [
    ['Nomor Pengajuan', data.nomorPengajuan],
    ['Tanggal', data.tanggal],
    [data.gudangLabel ?? 'Gudang', data.gudangNama],
    ['Status', data.statusLabel],
  ];
  if (data.jenis !== 'rusak') {
    fieldRows.push(['Keperluan', data.keperluan]);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const valueX = PAGE_MARGIN + FIELD_LABEL_WIDTH + 14;
  fieldRows.forEach(([label, value]) => {
    doc.text(label, PAGE_MARGIN, cursorY);
    doc.text(':', PAGE_MARGIN + FIELD_LABEL_WIDTH, cursorY);
    const wrapped = doc.splitTextToSize(String(value || '-'), pageWidth - PAGE_MARGIN - valueX);
    doc.text(wrapped, valueX, cursorY);
    cursorY += Math.max(14, wrapped.length * 12);
  });
  cursorY += 6;

  // Setiap jenis dapat paragraf pembuka naratif sendiri — supaya dokumen ini
  // tidak cuma berisi tabel data mentah, tapi juga kalimat kerja yang jelas
  // maksud pengajuannya (siapa yang mengajukan, untuk apa, dari/ke gudang
  // mana), sebelum masuk ke rincian barang di tabel.
  const nama = data.pelaporNama?.trim() || data.generatedBy?.trim() || '.....................';
  let kalimat: string;
  if (data.jenis === 'rusak') {
    kalimat =
      `Pada hari ini, saya (${nama}) sebagai petugas Gudang telah melakukan pengecekan terhadap sejumlah ` +
      'barang yang mengalami kerusakan dengan rincian sebagai berikut:';
  } else if (data.jenis === 'masuk') {
    kalimat =
      `Dengan ini, ${nama} mengajukan permintaan penerimaan barang ke Gudang ${data.gudangNama || '-'} ` +
      `untuk keperluan "${data.keperluan || '-'}". Rincian barang yang diajukan tercantum pada tabel di bawah ini, ` +
      'dan mohon ditindaklanjuti sesuai prosedur penerimaan barang yang berlaku.';
  } else {
    kalimat =
      `Dengan ini, ${nama} mengajukan permintaan pengeluaran barang dari Gudang ${data.gudangNama || '-'} ` +
      `untuk keperluan "${data.keperluan || '-'}". Rincian barang yang diajukan tercantum pada tabel di bawah ini, ` +
      'dan mohon ditindaklanjuti sesuai prosedur pengeluaran barang yang berlaku.';
  }
  const wrapped = doc.splitTextToSize(kalimat, pageWidth - PAGE_MARGIN * 2);
  doc.text(wrapped, PAGE_MARGIN, cursorY);
  cursorY += wrapped.length * 13 + 10;

  return cursorY + 4;
}

// Lebar SEMUA kolom tabel barang ditetapkan tetap (bukan dihitung otomatis
// dari isi lewat computeAutoTableColumnStyles) supaya total lebarnya bisa
// dijaga jauh di bawah area cetak A4 lanskap (~762pt) secara deterministik,
// berapa pun panjang nama/kode/merek/tipe barangnya — nama barang yang
// panjang cukup turun baris (wrap), bukan melebarkan kolom ke luar halaman.
function itemColumnOverrides(jenis: PengajuanCetakJenis): Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> {
  const shared: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: 28, halign: 'center' }, // No
    1: { cellWidth: 70 }, // Kode Barang
    2: { cellWidth: 160 }, // Nama Barang
    3: { cellWidth: 75 }, // Merek
    4: { cellWidth: 80 }, // Tipe
    5: { cellWidth: 80, halign: 'right' }, // Jumlah(Stok)
    6: { cellWidth: 52 }, // Satuan
  };
  if (jenis === 'rusak') {
    return { ...shared, 7: { cellWidth: 105 }, 8: { cellWidth: 105 } }; // Keterangan, Tindak Lanjut
  }
  return { ...shared, 7: { cellWidth: 135 } }; // Keterangan
}

function renderItemsTable(doc: jsPDF, data: PengajuanPrintData, startY: number, pageWidth: number, pageHeight: number): number {
  const headers = TABLE_HEADERS[data.jenis];
  const bodyRows = data.items.map((item, index) => {
    const row = [
      String(index + 1),
      item.sku ?? '-',
      item.namaBarang,
      item.merek?.trim() || '-',
      item.tipe?.trim() || '-',
      String(item.qty),
      item.satuan ?? '-',
      '', // Keterangan — diisi tulis tangan
    ];
    return data.jenis === 'rusak' ? [...row, ''] : row; // + Tindak Lanjut — diisi tulis tangan
  });

  const columnStyles = computeAutoTableColumnStyles(doc, headers, bodyRows, {
    fontSize: 9,
    cellPadding: 6,
    overrides: itemColumnOverrides(data.jenis),
  });

  let finalY = startY;
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [headers],
    body: bodyRows,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [40, 40, 40],
      overflow: 'linebreak',
      minCellHeight: 22,
    },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles,
    // horizontalPageBreak dimatikan khusus tabel ini: dengan lebar kolom
    // tetap (lihat itemColumnOverrides) yang sudah dijaga di bawah lebar
    // area cetak, fitur ini justru mengabaikan lebar yang ditetapkan dan
    // memecah kolom terakhir ke halaman terpisah — tidak dibutuhkan di sini.
    horizontalPageBreak: false,
    theme: 'grid',
    didDrawPage: (hook) => {
      finalY = hook.cursor?.y ?? finalY;
      renderPageFooter(doc, pageWidth, pageHeight);
    },
  });
  return finalY;
}

// Tabel nomor seri per barang (kalau ada barang isSerialized di antara
// items-nya) — dicetak terpisah di bawah tabel utama supaya staf gudang
// bisa memilih/mencocokkan unit fisiknya. Tidak digambar sama sekali kalau
// tidak ada barang ber-nomor-seri (return startY apa adanya).
function renderSerialTable(doc: jsPDF, data: PengajuanPrintData, startY: number, pageHeight: number): number {
  const serialRows = data.items.flatMap((item) =>
    (item.serialNumbers ?? []).map((sn) => [item.namaBarang, item.sku ?? '-', sn]),
  );
  if (serialRows.length === 0) {
    return startY;
  }

  let cursorY = startY;
  if (cursorY > pageHeight - 100) {
    doc.addPage();
    cursorY = PAGE_MARGIN;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Nomor Seri per Barang', PAGE_MARGIN, cursorY);
  cursorY += 6;
  const serialHeaders = ['Nama Barang', 'SKU', 'Nomor Seri'];
  let finalY = cursorY;
  autoTable(doc, {
    startY: cursorY + 6,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [serialHeaders],
    body: serialRows,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [40, 40, 40], overflow: 'linebreak' },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles: computeAutoTableColumnStyles(doc, serialHeaders, serialRows),
    horizontalPageBreak: true,
    theme: 'grid',
    didDrawPage: (hook) => {
      finalY = hook.cursor?.y ?? finalY;
    },
  });
  return finalY + 20;
}

// Blok tanda tangan: bentuk kotaknya tetap sama seperti sebelumnya, tapi
// nama/jabatan SELALU dikosongkan (garis titik-titik) — diisi tulis/ketik
// manual di atas kertas, bukan otomatis dari data "Setujui/Tolak" di
// sistem. Label "Bagian General Affairs (GA)" dipertahankan untuk semua
// jenis karena di organisasi ini super admin memang berperan sebagai
// GA/backup GA.
function renderSignatureBlock(doc: jsPDF, pageWidth: number, pageHeight: number, startY: number): void {
  let cursorY = startY;
  if (cursorY > pageHeight - SIGNATURE_BLOCK_HEIGHT - PAGE_MARGIN) {
    doc.addPage();
    cursorY = PAGE_MARGIN;
  }
  cursorY += 16;

  const boxWidth = (pageWidth - PAGE_MARGIN * 2 - 20) / 2;
  const boxHeight = SIGNATURE_BLOCK_HEIGHT;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + boxWidth + 20;

  doc.setDrawColor(200, 200, 200);
  doc.rect(leftX, cursorY, boxWidth, boxHeight);
  doc.rect(rightX, cursorY, boxWidth, boxHeight);

  function drawBlock(x: number, title: string): void {
    let y = cursorY + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text(title, x + 12, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Tanda tangan & nama jelas:', x + 12, y);

    y = cursorY + boxHeight - 34;
    doc.setDrawColor(150, 150, 150);
    doc.line(x + 12, y, x + boxWidth - 12, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('.......................................', x + 12, y);
    y += 12;
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('Jabatan: .......................', x + 12, y);
  }

  drawBlock(leftX, 'Bagian Pencatatan / Gudang');
  drawBlock(rightX, 'Bagian General Affairs (GA)');
}

function buildPengajuanDoc(data: PengajuanPrintData): jsPDF {
  // Landscape: dengan Merek & Tipe ditambahkan, tabel barang punya 8-9 kolom
  // — tidak muat dengan lega di lebar cetak A4 potret (~515pt). Landscape
  // (~762pt lebar cetak) memberi ruang yang cukup supaya semua kolom
  // (termasuk "Keterangan"/"Tindak Lanjut" yang sengaja kosong untuk diisi
  // tulis tangan) tetap dalam 1 halaman tanpa dipaksa terpotong/pecah kolom.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `pengajuan-${data.jenis}-${data.nomorPengajuan}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let cursorY = renderHeaderBrand(doc, pageWidth, data.generatedBy);
  cursorY = renderJudulDanField(doc, data, cursorY, pageWidth);
  cursorY = renderItemsTable(doc, data, cursorY, pageWidth, pageHeight) + 20;
  cursorY = renderSerialTable(doc, data, cursorY, pageHeight) + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  const catatanKaki = CATATAN_KAKI[data.jenis](data.gudangNama || '-');
  const wrappedCatatan = doc.splitTextToSize(catatanKaki, pageWidth - PAGE_MARGIN * 2);
  if (cursorY > pageHeight - 60 - wrappedCatatan.length * 12) {
    doc.addPage();
    cursorY = PAGE_MARGIN;
  }
  doc.text(wrappedCatatan, PAGE_MARGIN, cursorY);
  cursorY += wrappedCatatan.length * 12 + 10;

  renderSignatureBlock(doc, pageWidth, pageHeight, cursorY);

  return doc;
}

export function printPengajuanBarang(data: PengajuanPrintData): void {
  const doc = buildPengajuanDoc(data);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}

export function downloadPengajuanBarang(data: PengajuanPrintData): void {
  const doc = buildPengajuanDoc(data);
  doc.save(`pengajuan-${data.jenis}-${data.nomorPengajuan}.pdf`);
}
