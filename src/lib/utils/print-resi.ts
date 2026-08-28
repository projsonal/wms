import { jsPDF } from 'jspdf';
import type { Delivery } from '@/types';

const PAGE_MARGIN = 40;

export function printResiPengiriman(delivery: Delivery, generatedBy?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('WMS-RSD', PAGE_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('RESI PENGIRIMAN', pageWidth - PAGE_MARGIN, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(180, 83, 9);
  doc.text(delivery.code, PAGE_MARGIN, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(delivery.type === 'pickup' ? 'Jenis: Pickup (dijemput dari gudang)' : 'Jenis: Dropoff (diantar ke tujuan)', PAGE_MARGIN, y);
  y += 24;

  function field(label: string, value: string): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text(label.toUpperCase(), PAGE_MARGIN, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const wrapped = doc.splitTextToSize(value || '-', pageWidth - PAGE_MARGIN * 2);
    doc.text(wrapped, PAGE_MARGIN, y);
    y += wrapped.length * 13 + 12;
  }

  field('Asal Gudang', delivery.origin);
  field('Tujuan Pengiriman', delivery.destination);
  const penerimaLine = delivery.receiverPhone
    ? `${delivery.receiverName ?? '-'} (${delivery.receiverPhone})`
    : delivery.receiverName ?? '-';
  field('Penerima', penerimaLine);
  const kurirName = delivery.courierName || 'Belum ditugaskan';
  const kurirLine = delivery.courierPhone ? `${kurirName} (${delivery.courierPhone})` : kurirName;
  field('Kurir', kurirLine);
  field('Jadwal Kirim', new Date(delivery.scheduledAt).toLocaleDateString('id-ID', { dateStyle: 'long' }));
  if (delivery.notes) {
    field('Catatan', delivery.notes);
  }

  y += 8;
  const boxWidth = (pageWidth - PAGE_MARGIN * 2 - 16) / 2;
  const boxTop = y;
  const boxHeight = 70;
  doc.setDrawColor(210, 210, 210);
  doc.rect(PAGE_MARGIN, boxTop, boxWidth, boxHeight);
  doc.rect(PAGE_MARGIN + boxWidth + 16, boxTop, boxWidth, boxHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Diserahkan oleh (kurir)', PAGE_MARGIN + 6, boxTop + boxHeight - 8);
  doc.text('Diterima oleh (penerima)', PAGE_MARGIN + boxWidth + 22, boxTop + boxHeight - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const footerLine = generatedBy ? `Dicetak ${printedAt} oleh ${generatedBy}` : `Dicetak ${printedAt}`;
  doc.text(footerLine, PAGE_MARGIN, pageHeight - 20);

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
