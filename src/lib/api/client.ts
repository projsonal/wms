import { camelizeKeysDeep, snakeizeKeysDeep } from '@/lib/utils/casing';
import type { ApiEnvelope, ApiError, FieldError } from '@/types';

/**
 * Base URL backend gostock. Backend memasang seluruh route di bawah
 * prefix `/stockrsd` (lihat internal/routes/router.go), BUKAN `/api/v1`.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/stockrsd';

const ACCESS_TOKEN_KEY = 'stockrsd_access_token';
const REFRESH_TOKEN_KEY = 'stockrsd_refresh_token';
const BOT_TOKEN_KEY = 'stockrsd_bot_token';
const BOT_TOKEN_HEADER = 'X-Bot-Token';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
}

export const getAccessToken = (): string | null => readStorage(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null => readStorage(REFRESH_TOKEN_KEY);

/**
 * Flag sesi non-sensitif untuk `middleware.ts` (pola ala Clerk: middleware
 * di edge mengecek keberadaan sesi SEBELUM halaman dirender, supaya
 * halaman terproteksi tidak sempat "kelihatan" sekilas sebelum redirect).
 * Token asli (access/refresh) TETAP di localStorage & dikirim manual lewat
 * header Authorization seperti sebelumnya — cookie ini isinya cuma "1",
 * tidak membawa kredensial apa pun, jadi tidak menambah permukaan risiko
 * walau bisa dibaca lewat document.cookie.
 */
const SESSION_FLAG_COOKIE = 'stockrsd_has_session';

function setSessionFlagCookie(present: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (present) {
    // SameSite=Lax + tanpa flag Secure eksplisit (browser modern otomatis
    // mewajibkan Secure untuk cookie non-httpOnly di origin https).
    document.cookie = `${SESSION_FLAG_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_FLAG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export const setAccessToken = (token: string | null): void => {
  writeStorage(ACCESS_TOKEN_KEY, token);
  setSessionFlagCookie(Boolean(token));
};
export const setRefreshToken = (token: string | null): void => writeStorage(REFRESH_TOKEN_KEY, token);

/**
 * Token verifikasi anti-bot (bukan token login). Backend gostock memasang
 * middleware `BotCheck` di depan HAMPIR semua route (termasuk /auth/*,
 * lihat router.go) yang mewajibkan header `X-Bot-Token` valid. Token ini
 * didapat lewat alur captcha di POST /security/verify | /security/challenge,
 * dan DIROTASI oleh server di setiap response — makanya setiap response
 * di sini selalu dicek ulang untuk header X-Bot-Token yang baru.
 */
export const getBotToken = (): string | null => readStorage(BOT_TOKEN_KEY);
export const setBotToken = (token: string | null): void => writeStorage(BOT_TOKEN_KEY, token);

export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

class HttpError extends Error implements ApiError {
  code?: string;
  fieldErrors?: Record<string, string>;

  constructor(message: string, code?: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Dilempar khusus saat backend membalas 428 (bot-check diperlukan/kedaluwarsa)
 * supaya UI bisa menampilkan modal captcha alih-alih pesan error generik. */
export class BotCheckRequiredError extends Error {
  constructor() {
    super('verifikasi anti-bot diperlukan');
    this.name = 'BotCheckRequiredError';
  }
}

function toFieldErrorMap(errors: unknown): Record<string, string> | undefined {
  if (!Array.isArray(errors)) {
    return undefined;
  }
  const map: Record<string, string> = {};
  (errors as FieldError[]).forEach((item) => {
    if (item?.field) {
      map[item.field] = item.message;
    }
  });
  return map;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Lewati penyisipan header Authorization (dipakai sebelum login). */
  skipAuth?: boolean;
  /** Lewati penyisipan header X-Bot-Token (dipakai oleh endpoint /security & /captcha sendiri). */
  skipBotToken?: boolean;
}

interface EnvelopeResult<TResponse> {
  data: TResponse;
  meta: PaginationMeta | undefined;
}

/**
 * Refresh access token OTOMATIS saat kedaluwarsa — access token cuma
 * berumur 15 menit (JWT_ACCESS_EXPIRY_MINUTES), jadi tanpa ini SETIAP
 * aksi (simpan form, dst.) yang dilakukan lebih dari 15 menit setelah
 * login/refresh terakhir akan SELALU gagal dengan "token tidak valid
 * atau kedaluwarsa" — persis kondisi yang tadinya membingungkan karena
 * user tetap terlihat "login" (halaman tidak redirect ke /login) padahal
 * token di baliknya sudah basi. `refreshPromise` di-share supaya banyak
 * request yang gagal bersamaan tidak memicu banyak panggilan refresh
 * paralel (cukup satu, yang lain menunggu hasil yang sama).
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    return false;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        });
        if (!response.ok) {
          return false;
        }
        const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
        const envelope = rawEnvelope ? camelizeKeysDeep<ApiEnvelope<Record<string, unknown>>>(rawEnvelope) : null;
        if (!envelope?.success || !envelope.data) {
          return false;
        }
        const newAccessToken = envelope.data.accessToken as string | undefined;
        const newRefreshToken = envelope.data.refreshToken as string | undefined;
        if (!newAccessToken) {
          return false;
        }
        setAccessToken(newAccessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * Inti pengambilan data yang dipakai `apiRequest`/`apiRequestWithMeta` —
 * ekstrak jadi satu fungsi supaya logika retry-setelah-refresh-token tidak
 * perlu ditulis dua kali. `isRetry` mencegah retry berulang tanpa akhir
 * kalau refresh sendiri juga gagal (mis. refresh token juga sudah
 * kedaluwarsa — dalam kasus itu, sesi memang harus login ulang).
 */
async function executeRequest<TResponse>(
  path: string,
  options: RequestOptions,
  isRetry = false,
): Promise<EnvelopeResult<TResponse>> {
  const { method = 'GET', body, signal, skipAuth = false, skipBotToken = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const accessToken = skipAuth ? null : getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const botToken = skipBotToken ? null : getBotToken();
  if (botToken) {
    headers[BOT_TOKEN_HEADER] = botToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(snakeizeKeysDeep(body)) : undefined,
    signal,
  });

  // Server merotasi bot-token di setiap respons (lihat botcheck_middleware.go) —
  // simpan token terbaru supaya request berikutnya tetap lolos gerbang.
  const rotatedBotToken = response.headers.get(BOT_TOKEN_HEADER);
  if (rotatedBotToken) {
    setBotToken(rotatedBotToken);
  }

  // Access token kedaluwarsa -> coba refresh SEKALI, lalu ulangi request
  // asli dengan token baru. Tidak berlaku untuk request yang memang tidak
  // butuh auth (skipAuth) atau yang sudah pernah di-retry sebelumnya.
  if (response.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return executeRequest<TResponse>(path, options, true);
    }
    // Refresh token juga sudah tidak berlaku -> sesi memang harus diulang
    // dari awal; bersihkan token basi supaya UI tidak terjebak "terlihat
    // login" padahal tidak ada token valid sama sekali.
    clearSession();
  }

  const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

  // Beberapa deployment backend gostock membalas gerbang anti-bot dengan
  // status non-428 (mis. 401/403) tapi tetap membawa pesan yang menyuruh
  // menuntaskan captcha di /security/challenge. Deteksi juga polanya di
  // pesan supaya UI tetap memicu modal captcha, bukan cuma teks error datar.
  // Fallback berbasis kata kunci ini SENGAJA dilewati untuk endpoint yang
  // skipBotToken=true (yaitu /captcha & /security sendiri) — endpoint itu
  // wajar membalas pesan yang memuat kata "captcha" untuk error aslinya
  // sendiri (mis. "gagal membuat captcha", "jawaban captcha salah"), dan
  // tanpa pengecualian ini pesan asli itu akan salah tertangkap sebagai
  // "perlu bot-check lagi" alih-alih ditampilkan apa adanya ke user.
  const looksLikeBotCheck =
    response.status === 428 ||
    (!skipBotToken &&
      !response.ok &&
      typeof rawEnvelope?.message === 'string' &&
      /bot|captcha/i.test(rawEnvelope.message));

  if (looksLikeBotCheck) {
    throw new BotCheckRequiredError();
  }

  const envelope = rawEnvelope ? camelizeKeysDeep<ApiEnvelope<TResponse>>(rawEnvelope) : null;

  if (!response.ok || !envelope?.success) {
    throw new HttpError(
      envelope?.message ?? `Permintaan gagal dengan status ${response.status}`,
      String(response.status),
      toFieldErrorMap(envelope?.errors),
    );
  }

  return { data: envelope.data as TResponse, meta: envelope.meta as PaginationMeta | undefined };
}

/**
 * Client HTTP tipis di atas fetch untuk memanggil REST API gostock.
 * - Membongkar Envelope `{ success, message, data, errors }` jadi `data` langsung.
 * - Menyisipkan `Authorization: Bearer <access_token>` otomatis.
 * - Menyisipkan & memperbarui `X-Bot-Token` otomatis (server merotasinya tiap respons).
 * - Refresh access token otomatis sekali kalau kedaluwarsa (lihat executeRequest).
 * - Melempar `BotCheckRequiredError` saat status 428 supaya UI bisa memicu modal captcha.
 */
export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { data } = await executeRequest<TResponse>(path, options);
  return data;
}

/**
 * Sama seperti `apiRequest`, tapi juga mengembalikan `meta` dari envelope
 * (dipakai endpoint list yang berpaginasi — lihat pkg/utils/response.go
 * `OKWithMeta` di backend, yang menaruh info halaman di `meta`, BUKAN
 * disisipkan ke dalam `data`).
 */
export async function apiRequestWithMeta<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: TResponse; meta: PaginationMeta | undefined }> {
  return executeRequest<TResponse>(path, options);
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { method: 'GET', ...options }),
  /** Untuk endpoint list yang berpaginasi (mengembalikan `meta` dari backend). */
  getPaginated: <T>(path: string, signal?: AbortSignal) =>
    apiRequestWithMeta<T[]>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/**
 * Unduh file biner (Excel/PDF/DOCX, dsb) dari backend — beda dari
 * `apiClient.*` di atas yang selalu mengharap balasan JSON. Dipakai untuk
 * endpoint seperti `/laporan/export` yang membalas file langsung lewat
 * header Content-Disposition, bukan `{ data, meta }`.
 */
/**
 * Fetch GET biasa + header Authorization, dengan retry-setelah-refresh-token
 * sekali kalau kena 401 — dipakai bareng oleh `downloadFile` &
 * `fetchAuthedBlobUrl` di bawah supaya logikanya tidak duplikat.
 */
async function fetchWithAuthRetry(path: string, isRetry = false): Promise<Response> {
  const accessToken = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (res.status === 401 && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchWithAuthRetry(path, true);
    }
    clearSession();
  }
  return res;
}

export async function downloadFile(path: string, suggestedFilename?: string): Promise<void> {
  const response = await fetchWithAuthRetry(path);
  if (!response.ok) {
    let message = `Gagal mengunduh file (status ${response.status}).`;
    try {
      const body = (await response.json()) as ApiEnvelope<unknown>;
      if (body?.message) message = body.message;
    } catch {
      // respons error bukan JSON (mis. HTML dari proxy) -> pakai pesan default di atas
    }
    throw new HttpError(message, String(response.status));
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = filenameMatch?.[1] ?? suggestedFilename ?? 'unduhan';

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { HttpError };

/**
 * Ambil resource biner yang butuh login (mis. GET /users/:id/avatar — lihat
 * ServeAvatar di internal/controller/users/user_controller.go, WAJIB header
 * Authorization) dan kembalikan sebagai object URL (`URL.createObjectURL`)
 * yang bisa langsung dipakai di `<img src>`.
 *
 * KENAPA INI PERLU: tag `<img src="...">` browser TIDAK bisa disuruh
 * menyisipkan header custom seperti Authorization — beda dari
 * `apiRequest`/`apiClient` yang manual fetch + header. Endpoint avatar
 * sengaja mewajibkan token (foto profil = data pribadi, tidak boleh
 * dibuka siapa saja lewat URL statis, lihat catatan di ServeAvatar), jadi
 * satu-satunya cara menampilkannya di <img> adalah fetch manual dulu lalu
 * ubah hasilnya jadi blob URL — persis pola yang sudah dipakai
 * `downloadFile` di atas, cuma di sini hasilnya dipakai untuk ditampilkan,
 * bukan diunduh.
 *
 * `path` relatif terhadap API_BASE_URL (mis. "/users/5/avatar?v=123",
 * hasil dari field `avatar_url` di Response backend) — BUKAN API_ORIGIN
 * seperti `resolveUploadUrl`, karena route ini terdaftar di bawah grup
 * `/stockrsd` (lihat internal/routes/router.go), bukan static root.
 * Mengembalikan `null` kalau resource tidak ada (404, mis. user belum
 * pernah upload foto) supaya pemanggil bisa jatuh ke avatar inisial tanpa
 * dianggap error.
 */
export async function fetchAuthedBlobUrl(path: string): Promise<string | null> {
  const response = await fetchWithAuthRetry(path);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new HttpError(`Gagal memuat gambar (status ${response.status}).`, String(response.status));
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Origin backend TANPA path prefix (`/stockrsd`) — dipakai untuk resolve
 * URL file yang disajikan statis di root app, seperti foto profil hasil
 * upload (`/uploads/avatars/xxx.jpg`, lihat app.Static("/uploads", ...) di
 * internal/routes/router.go). BEDA dari API_BASE_URL yang sudah termasuk
 * `/stockrsd` untuk endpoint REST.
 */
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
})();

/** Gabungkan path relatif (mis. avatarUrl dari backend) dengan API_ORIGIN.
 * Path yang sudah absolut (http/https) dikembalikan apa adanya. */
export function resolveUploadUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Upload file (multipart/form-data) ke backend — beda dari `apiClient.*`
 * yang selalu mengirim JSON. Dipakai untuk endpoint seperti
 * `POST /users/me/avatar` (lihat internal/controller/users UploadAvatar).
 * `fieldName` harus sama persis dengan nama field yang dibaca backend lewat
 * `c.FormFile("...")`.
 */
export async function uploadFile<TResponse>(
  path: string,
  file: File,
  fieldName = 'file',
): Promise<TResponse> {
  async function attempt(isRetry: boolean): Promise<Response> {
    const accessToken = getAccessToken();
    const botToken = getBotToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (botToken) headers[BOT_TOKEN_HEADER] = botToken;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers, // JANGAN set Content-Type manual — browser mengisi boundary multipart otomatis
      body: formData,
    });

    const rotatedBotToken = res.headers.get(BOT_TOKEN_HEADER);
    if (rotatedBotToken) setBotToken(rotatedBotToken);

    if (res.status === 401 && !isRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return attempt(true);
      clearSession();
    }
    return res;
  }

  const response = await attempt(false);
  const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
  const envelope = rawEnvelope ? camelizeKeysDeep<ApiEnvelope<TResponse>>(rawEnvelope) : null;

  if (!response.ok || !envelope?.success) {
    throw new HttpError(
      envelope?.message ?? `Gagal mengunggah file (status ${response.status}).`,
      String(response.status),
      toFieldErrorMap(envelope?.errors),
    );
  }
  return envelope.data as TResponse;
}
