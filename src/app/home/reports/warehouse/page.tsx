import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

// Catatan: backend belum punya tipe laporan "Gudang" tersendiri (baru ada
// Stok Barang, Barang Masuk, Barang Keluar, Purchase Order, Stock Opname —
// lihat pkg/constant/cons_laporan.go). Judul halaman ini SENGAJA
// disesuaikan ke "Laporan Stock Opname" (bukan lagi "Laporan Gudang")
// supaya sesuai dengan data yang benar-benar ditampilkan, bukan label yang
// menyesatkan. Kalau laporan utilisasi per-gudang memang dibutuhkan, itu
// perlu endpoint baru di backend (agregasi kapasitas/rak per gudang).
export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Stock Opname"
      breadcrumb="Laporan / Laporan Stock Opname"
      reportType="Stock Opname"
    />
  );
}
