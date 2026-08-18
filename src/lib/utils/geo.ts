export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Jarak garis lurus (haversine) dalam KM antara dua koordinat — TANPA
 * request jaringan apa pun, jadi aman dipakai untuk banyak baris tabel
 * sekaligus (mis. daftar Pickup & Dropoff). Ini BUKAN jarak jalan
 * sungguhan (tidak mengikuti kelokan jalan raya) — untuk rute jalan asli
 * yang presisi, pakai fetchRoadRoute (OSRM) di halaman Detail Pengiriman,
 * yang SENGAJA cuma dipanggil untuk SATU pengiriman yang sedang dibuka
 * (memanggilnya untuk seluruh baris tabel sekaligus akan membebani server
 * OSRM publik — itulah kenapa daftar/tabel di sini pakai estimasi garis
 * lurus, bukan rute jalan asli).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // radius Bumi, km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Kecepatan rata-rata perkiraan motor/mobil di jalan kota Indonesia
// (dengan lampu merah, kemacetan ringan, dll) — dipakai untuk mengubah
// jarak garis lurus jadi estimasi waktu tempuh KASAR. Jarak garis lurus
// selalu lebih pendek dari jarak jalan sungguhan (jalan tidak lurus), jadi
// angka ini SENGAJA dibuat lebih rendah dari kecepatan rata-rata jalan
// bebas hambatan supaya estimasi waktu tidak jauh meleset ke bawah.
const ASSUMED_AVG_SPEED_KMH = 28;

export function estimateDurationMin(distanceKm: number): number {
  return (distanceKm / ASSUMED_AVG_SPEED_KMH) * 60;
}

export function formatDurationMin(min: number): string {
  if (min < 60) return `${Math.round(min)} menit`;
  const hours = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
}
