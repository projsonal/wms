/**
 * Endpoint health check backend gostock (internal/health) didaftarkan di
 * ROOT app, BUKAN di bawah prefix `/stockrsd` seperti endpoint lain —
 * lihat internal/routes/router.go: `app.Get("/health", ...)` dipanggil
 * sebelum `api := app.Group("/stockrsd")`.
 */

function resolveHealthUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/stockrsd';
  const root = apiBase.replace(/\/stockrsd\/?$/, '');
  return `${root}/health`;
}

export interface BackendHealthResult {
  reachable: boolean;
  /** true kalau server merespons TAPI melaporkan salah satu komponen inti (mis. DB) bermasalah. */
  degraded: boolean;
  message: string;
}

/** Dipakai untuk diagnosa cepat saat halaman login gagal menghubungi backend. */
export async function checkBackendHealth(): Promise<BackendHealthResult> {
  const url = resolveHealthUrl();
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.status === 503) {
      return { reachable: true, degraded: true, message: 'Backend hidup, tapi salah satu komponen inti (mis. database) bermasalah.' };
    }
    if (!res.ok) {
      return { reachable: false, degraded: false, message: `Backend merespons dengan status ${res.status}.` };
    }
    return { reachable: true, degraded: false, message: 'Backend terjangkau dan sehat.' };
  } catch {
    return {
      reachable: false,
      degraded: false,
      message: `Tidak bisa menghubungi ${url}. Pastikan backend gostock berjalan & CORS_ALLOWED_ORIGINS mengizinkan origin frontend ini.`,
    };
  }
}
