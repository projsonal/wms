import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy proteksi rute ala Clerk: berjalan di edge SEBELUM halaman
 * dirender, jadi halaman terproteksi tidak sempat "kelihatan sekilas"
 * untuk pengguna yang belum login (beda dari proteksi client-side murni
 * lewat RoleGuard, yang baru redirect setelah komponen sempat mount).
 *
 * Sejak Next.js 16, convention file "middleware.ts" DIDEPRESIASI dan
 * diganti "proxy.ts" (fungsi yang di-export juga berganti nama dari
 * `middleware` ke `proxy`) — lihat https://nextjs.org/docs/messages/middleware-to-proxy.
 * Perilakunya identik dengan middleware lama, cuma nama file & fungsinya
 * yang berubah.
 *
 * PENTING soal apa yang dicek: token asli (access/refresh JWT) TETAP
 * disimpan di localStorage & dikirim manual lewat header Authorization ke
 * backend gostock (lihat lib/api/client.ts) — itu tidak berubah. Proxy
 * ini di edge Next.js TIDAK bisa membaca localStorage (beda proses dari
 * browser), jadi yang dicek di sini adalah cookie flag non-sensitif
 * `stockrsd_has_session` (isinya cuma "1", diset/dihapus bersamaan dengan
 * access token — lihat setAccessToken() di client.ts). Ini bukan cookie
 * sesi yang dipakai untuk otorisasi API; cuma penanda "ada sesi aktif"
 * untuk keputusan redirect di level routing. Pengecekan HAK AKSES
 * sesungguhnya (role, permission) tetap terjadi di RoleGuard (client) &
 * di backend (JWT asli, divalidasi ulang tiap request API) — proxy
 * ini murni lapisan UX/pertahanan-berlapis, bukan satu-satunya gerbang.
 */

const SESSION_FLAG_COOKIE = 'stockrsd_has_session';

// Halaman login/registrasi: bisa diakses TANPA sesi, tapi kalau user
// SUDAH login dan tetap membuka ini, lempar ke dashboard (pola Clerk
// afterSignInUrl) — beda dari ALWAYS_ACCESSIBLE_PATHS di bawah.
const AUTH_ONLY_PATHS = ['/login', '/register'];

// Rute yang SELALU bisa diakses baik ada sesi maupun tidak, TANPA pernah
// dipaksa redirect. "/status" khususnya dipakai RoleGuard.tsx untuk
// menampilkan halaman 403 ke user yang SUDAH login tapi rolenya tidak
// diizinkan — kalau ini ikut logika AUTH_ONLY_PATHS di atas, user yang
// justru punya sesi (skenario paling umum untuk 403) akan langsung
// dilempar balik ke /dashboard sebelum sempat melihat pesannya.
const ALWAYS_ACCESSIBLE_PATHS = ['/changelog', '/status'];

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_FLAG_COOKIE)?.value === '1';

  if (matchesAny(pathname, ALWAYS_ACCESSIBLE_PATHS)) {
    return NextResponse.next();
  }

  if (matchesAny(pathname, AUTH_ONLY_PATHS)) {
    // Sudah login tapi mencoba buka /login atau /register lagi -> lempar
    // ke dashboard, konsisten dengan pola Clerk (afterSignInUrl).
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // Simpan tujuan asal supaya bisa dikembalikan setelah login berhasil,
    // mirip redirect_url yang dipakai Clerk.
    loginUrl.searchParams.set('redirect', pathname);
    // Tandai alasan redirect (bukan cuma diam-diam melempar) — dibaca
    // login/page.tsx untuk menampilkan pesan "halaman ini tidak boleh
    // diakses, silakan masuk kembali" (lihat StatusScreen kode 401).
    // SENGAJA tidak lewat halaman perantara /status/401 dulu: itu akan
    // membuat konten terproteksi sempat "kelihatan sekilas" sebelum
    // redirect — bertentangan dengan alasan proxy ini dibuat di awal
    // (lihat catatan besar di atas file).
    loginUrl.searchParams.set('reason', 'unauthorized');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Semua path KECUALI: file statis Next.js internal (_next/*), favicon,
  // folder aset publik, DAN "/api/gowms/*" & "/uploads/*" — dua yang
  // terakhir itu jalur proxy ke backend gostock (lihat next.config.ts
  // rewrites), BUKAN halaman yang perlu proteksi login/role di level
  // ini. Middleware ini murni untuk NAVIGASI HALAMAN; permintaan API
  // sudah divalidasi sendiri oleh backend lewat JWT di header
  // Authorization pada tiap request (lihat lib/api/client.ts) — TIDAK
  // butuh & TIDAK boleh ikut dicek cookie sesi di sini.
  //
  // Riwayat bug: sebelum jalur "/api/gowms" ini ada (API dulu langsung
  // ke URL absolut backend, bukan lewat proxy Next.js), matcher ini
  // tidak masalah karena permintaan API tidak pernah lewat proxy.ts
  // sama sekali. Begitu API dipindah ke path relatif lewat proxy
  // (next.config.ts rewrites), SETIAP permintaan API — termasuk POST
  // /api/gowms/auth/login, yaitu permintaan LOGIN ITU SENDIRI — mulai
  // ikut tersaring middleware ini, dan karena belum ada cookie sesi
  // (wajar, orangnya belum login), langsung dilempar balik ke
  // /login?redirect=... alih-alih diteruskan ke backend. Efeknya login
  // jadi mustahil berhasil dari perangkat mana pun yang memakai jalur
  // proxy ini (paling kentara di HP karena itu jalur satu-satunya yang
  // dipakai HP, tapi PC yang sudah pindah ke NEXT_PUBLIC_API_BASE_URL=
  // /api/gowms ikut kena juga).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|api/gowms/|uploads/).*)'],
};