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
export const setAccessToken = (token: string | null): void => writeStorage(ACCESS_TOKEN_KEY, token);
export const getRefreshToken = (): string | null => readStorage(REFRESH_TOKEN_KEY);
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

/**
 * Client HTTP tipis di atas fetch untuk memanggil REST API gostock.
 * - Membongkar Envelope `{ success, message, data, errors }` jadi `data` langsung.
 * - Menyisipkan `Authorization: Bearer <access_token>` otomatis.
 * - Menyisipkan & memperbarui `X-Bot-Token` otomatis (server merotasinya tiap respons).
 * - Melempar `BotCheckRequiredError` saat status 428 supaya UI bisa memicu modal captcha.
 */
export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
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

  const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

  // Beberapa deployment backend gostock membalas gerbang anti-bot dengan
  // status non-428 (mis. 401/403) tapi tetap membawa pesan yang menyuruh
  // menuntaskan captcha di /security/challenge. Deteksi juga polanya di
  // pesan supaya UI tetap memicu modal captcha, bukan cuma teks error datar.
  const looksLikeBotCheck =
    response.status === 428 ||
    (!response.ok &&
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

  return envelope.data as TResponse;
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

  const rotatedBotToken = response.headers.get(BOT_TOKEN_HEADER);
  if (rotatedBotToken) {
    setBotToken(rotatedBotToken);
  }

  const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

  const looksLikeBotCheck =
    response.status === 428 ||
    (!response.ok &&
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

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { method: 'GET', signal }),
  /** Untuk endpoint list yang berpaginasi (mengembalikan `meta` dari backend). */
  getPaginated: <T>(path: string, signal?: AbortSignal) =>
    apiRequestWithMeta<T[]>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

export { HttpError };
