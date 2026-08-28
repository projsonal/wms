import { jsPDF } from 'jspdf';

export interface SkuLabelItem {
  sku: string;
  name: string;
  merek?: string;
  tipe?: string;

  qty?: number;
}

const PAGE_MARGIN = 24;
const COLS = 3;
const ROWS = 8;
const GUTTER = 8;

async function barcodeDataUrl(value: string): Promise<string> {
  const { default: JsBarcode } = await import('jsbarcode');
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width: 2,
    height: 46,
    displayValue: false,
    margin: 0,
  });
  return canvas.toDataURL('image/png');
}

function flattenByQty(items: SkuLabelItem[]): SkuLabelItem[] {
  const flat: SkuLabelItem[] = [];
  items.forEach((item) => {
    const qty = Math.max(1, item.qty ?? 1);
    for (let i = 0; i < qty; i += 1) {
      flat.push(item);
    }
  });
  return flat;
}

export async function printSkuLabels(items: SkuLabelItem[], generatedBy?: string): Promise<void> {
  const flat = flattenByQty(items);
  if (flat.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;
  const usableHeight = pageHeight - PAGE_MARGIN * 2;
  const labelWidth = (usableWidth - GUTTER * (COLS - 1)) / COLS;
  const labelHeight = (usableHeight - GUTTER * (ROWS - 1)) / ROWS;
  const perPage = COLS * ROWS;

  const uniqueSkus = Array.from(new Set(flat.map((it) => it.sku)));
  const barcodeCache = new Map<string, string>();
  for (const sku of uniqueSkus) {
    try {
      barcodeCache.set(sku, await barcodeDataUrl(sku));
    } catch {
      // SKU dengan karakter yang tidak bisa dikodekan Code-128 (sangat
      // jarang) — lewati barcode-nya, teks SKU tetap dicetak di bawahnya.
    }
  }

  flat.forEach((item, index) => {
    const pageIndex = Math.floor(index / perPage);
    const posInPage = index % perPage;
    const col = posInPage % COLS;
    const row = Math.floor(posInPage / COLS);

    if (posInPage === 0 && pageIndex > 0) {
      doc.addPage();
    }

    const x = PAGE_MARGIN + col * (labelWidth + GUTTER);
    const y = PAGE_MARGIN + row * (labelHeight + GUTTER);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.rect(x, y, labelWidth, labelHeight);

    const innerX = x + 6;
    const innerWidth = labelWidth - 12;
    let cursorY = y + 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    const nameLine = doc.splitTextToSize(item.name, innerWidth)[0] ?? item.name;
    doc.text(nameLine, innerX, cursorY);
    cursorY += 9;

    const merekTipe = [item.merek, item.tipe].filter(Boolean).join(' ');
    if (merekTipe) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(110, 110, 110);
      const merekLine = doc.splitTextToSize(merekTipe, innerWidth)[0] ?? merekTipe;
      doc.text(merekLine, innerX, cursorY);
      cursorY += 8;
    }

    const barcode = barcodeCache.get(item.sku);
    const barcodeHeight = Math.min(28, labelHeight - (cursorY - y) - 16);
    if (barcode && barcodeHeight > 10) {
      doc.addImage(barcode, 'PNG', innerX, cursorY, innerWidth, barcodeHeight);
      cursorY += barcodeHeight + 4;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    doc.text(item.sku, x + labelWidth / 2, Math.min(cursorY + 2, y + labelHeight - 6), { align: 'center' });
  });

  if (generatedBy) {
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(160, 160, 160);
      doc.text(`Dicetak oleh ${generatedBy} — halaman ${p}/${totalPages}`, PAGE_MARGIN, pageHeight - 10);
    }
  }

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
