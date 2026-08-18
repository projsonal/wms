'use client';

/**
 * FAB navigasi cepat global untuk HP SENGAJA DINONAKTIFKAN (return null).
 *
 * Sebelumnya komponen ini muncul sebagai *fallback* floating button di
 * halaman yang tidak punya aksi CRUD (mis. Dashboard) — sesuai permintaan
 * eksplisit, floating button di HP sekarang HANYA boleh muncul di halaman
 * yang benar-benar punya aksi CRUD (Add/Change/Delete/dst), dan itu sudah
 * ditangani sepenuhnya oleh `TableRowActionBar` -> `MobileFabActionMenu`,
 * TIDAK bergantung pada komponen ini sama sekali.
 *
 * Dashboard & halaman lain tanpa tabel aksi sekarang tidak menampilkan
 * floating button apa pun — navigasi tetap tersedia lewat tombol hamburger
 * (`SidebarMobileToggle`) di Header seperti biasa.
 *
 * Diekspor tetap sebagai no-op (bukan dihapus filenya) supaya pemasangannya
 * di `src/app/home/layout.tsx` tidak perlu diubah, dan gampang diaktifkan
 * lagi kalau kebutuhannya berubah nanti.
 */
export function MobileFloatingMenu(): null {
  return null;
}
