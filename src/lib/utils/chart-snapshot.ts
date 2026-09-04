// Mengubah elemen <svg> chart (Recharts) yang sedang tampil di layar jadi
// gambar PNG (data URL) supaya bisa disisipkan ke dokumen PDF — dipakai
// khusus untuk menyertakan bagian "Analisa Data" ke cetakan Laporan (lihat
// ReportPageTemplate.tsx). Tidak menambah dependency baru (mis. html2canvas):
// SVG-nya cukup diserialisasi jadi string lalu digambar ulang ke <canvas>
// lewat elemen <img>, karena Recharts sudah menaruh warna/gaya sebagai
// atribut langsung di elemen-elemen SVG-nya (bukan cuma lewat CSS class
// eksternal), sehingga cara ini cukup akurat untuk kebutuhan cetak.
export interface ChartSnapshot {
  dataUrl: string;
  aspectRatio: number;
}

export async function captureSvgAsPng(svg: SVGSVGElement, scale = 2): Promise<ChartSnapshot | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || svg.clientWidth || 480));
    const height = Math.max(1, Math.round(rect.height || svg.clientHeight || 240));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('viewBox')) {
      clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('gagal memuat gambar chart untuk cetak'));
        el.src = blobUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      // Latar putih solid — SVG chart biasanya transparan, dan PDF akan
      // tampak aneh (transparan di atas kertas) tanpa ini.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: height / width };
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    // Gagal snapshot (mis. browser lama/aneh) — pemanggil cukup melewati
    // bagian chart di dokumen cetak, bukan menggagalkan seluruh cetakan.
    return null;
  }
}

/** Mencari elemen <svg> pertama di dalam container (mis. wrapper ResponsiveContainer dari Recharts). */
export function findChartSvg(container: HTMLElement | null): SVGSVGElement | null {
  if (!container) return null;
  return container.querySelector('svg');
}
