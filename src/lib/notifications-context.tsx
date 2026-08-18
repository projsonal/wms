/**
 * Preferensi "Notifikasi Aset" (Settings -> Notifikasi) — default AKTIF.
 * Disimpan lokal per-perangkat (bukan per-akun di server) karena memang
 * cuma soal "tampilkan/jangan tampilkan toast di browser ini", bukan
 * pengaturan bisnis yang perlu tersinkron lintas perangkat.
 *
 * CATATAN SEJARAH — kenapa file ini isinya cuma dua fungsi kecil:
 * File ini SEBELUMNYA juga berisi `NotificationsProvider`, sebuah context
 * yang polling `GET /dashboard/notifications` tiap 15 detik lewat
 * `lib/api/api.ts` (proxy internal `/api/gostock/...`). Provider itu SUDAH
 * DIHAPUS karena:
 *   1. Rewrite `/api/gostock/*` -> backend TIDAK PERNAH aktif (lihat
 *      `next.config.ts`, blok `rewrites()`-nya dikomentari, dan bahkan
 *      prefix path di dalamnya "/api/gowms" — beda dari "/api/gostock"
 *      yang dipanggil kode). Akibatnya SETIAP polling 15 detik pasti 404,
 *      dan itulah sumber log error yang "spam" di console.
 *   2. Bahkan seandainya proxy-nya jalan, polling penuh tiap 15 detik ke
 *      endpoint gabungan (UNION lintas 6 tabel di backend) untuk semua
 *      user yang online adalah pola yang berat/tidak efisien.
 *   3. Bell notifikasi yang dirender di Header (`component/layout/
 *      NotificationBell.tsx`) SUDAH punya sistem sendiri yang jauh lebih
 *      ringan & memang dipakai: poll ringan `GET /notifications/unread-
 *      count` tiap 60 detik (cuma angka, bukan tarik semua baris), dan
 *      daftar lengkapnya baru di-fetch ("lazy") saat lonceng benar-benar
 *      diklik/dibuka — bukan terus-menerus di background.
 * Komponen `component/ui/NotificationBell.tsx` (konsumen lain provider
 * ini) juga sudah tidak dipakai di mana pun (Header memakai
 * `component/layout/NotificationBell.tsx`), jadi ikut dihapus sekalian
 * dengan `lib/api/api.ts` yang sebelumnya cuma dipakai provider ini.
 */

const ASSET_NOTIF_PREF_KEY = 'wms_notif_asset_enabled';

export function isAssetNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(ASSET_NOTIF_PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setAssetNotifEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ASSET_NOTIF_PREF_KEY, enabled ? '1' : '0');
}

const STOCK_NOTIF_PREF_KEY = 'wms_notif_stock_enabled';

/** Preferensi "Peringatan Stok Minimum" (Settings -> Notifikasi) — default
 * AKTIF. Dipakai NotificationBell.tsx untuk menyaring notifikasi bertipe
 * "stok_menipis" (dibuat backend saat barang keluar/stock opname bikin
 * stok sebuah barang baru saja turun ke/di bawah ambang minimumnya —
 * lihat notifyLowStock() di barang_keluar_controller.go & stockOpname_
 * controller.go). Backend TETAP membuat notifikasinya untuk semua user
 * (broadcast "all") terlepas dari preferensi ini — preferensi ini murni
 * soal apakah notifikasi itu DITAMPILKAN di perangkat/browser INI, bukan
 * soal apakah notifikasi itu dibuat sama sekali (kalau tidak dibuat sama
 * sekali, user lain yang preferensinya ON tidak akan pernah melihatnya). */
export function isStockNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STOCK_NOTIF_PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setStockNotifEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STOCK_NOTIF_PREF_KEY, enabled ? '1' : '0');
}
