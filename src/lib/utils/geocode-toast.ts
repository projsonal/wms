import type { GeocodePrecision } from '@/lib/api/modules';

// Pesan toast untuk hasil pencarian koordinat dari alamat — jujur soal
// seberapa presisi titik yang ditemukan (bukan generik "ditemukan" untuk
// semua kasus seperti sebelumnya), supaya pengguna tahu kapan perlu
// menggeser pin di peta secara manual.
export function geocodePrecisionMessage(precision: GeocodePrecision, displayName: string): string {
  switch (precision) {
    case 'street':
      return `Koordinat ditemukan (level jalan): ${displayName}`;
    case 'area':
      return `Koordinat ditemukan di level kelurahan/desa: ${displayName} — geser pin di peta kalau kurang presisi.`;
    case 'region':
      return `Alamat persis tidak ketemu, dipakai titik kabupaten/kota terdekat: ${displayName} — sebaiknya geser pin di peta ke lokasi sebenarnya.`;
    default:
      return `Koordinat ditemukan: ${displayName} — geser pin di peta kalau kurang presisi.`;
  }
}
