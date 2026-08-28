

function resolveHealthUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/stockrsd';
  const root = apiBase.replace(/\/stockrsd\/?$/, '');
  return `${root}/health`;
}

export interface BackendHealthResult {
  reachable: boolean;

  degraded: boolean;
  message: string;
}

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
