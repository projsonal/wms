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

// Rute yang TETAP bisa diakses tanpa sesi (halaman otentikasi & changelog
// publik). Semua rute lain di luar daftar publik & aset statis dianggap
// terproteksi.
const PUBLIC_PATHS = ['/login', '/register', '/changelog'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_FLAG_COOKIE)?.value === '1';

  if (isPublicPath(pathname)) {
    // Sudah login tapi mencoba buka /login atau /register lagi -> lempar
    // ke dashboard, konsisten dengan pola Clerk (afterSignInUrl).
    if (hasSession) {
      return NextResponse.redirect(new URL('/home/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // Simpan tujuan asal supaya bisa dikembalikan setelah login berhasil,
    // mirip redirect_url yang dipakai Clerk.
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Semua path KECUALI file statis Next.js internal (_next/*), favicon,
  // dan folder aset publik — biarkan itu lewat tanpa dicek.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
};
