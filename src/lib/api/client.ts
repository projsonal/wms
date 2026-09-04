import { camelizeKeysDeep, snakeizeKeysDeep } from '@/lib/utils/casing';
import type { ApiEnvelope, ApiError, FieldError } from '@/types';

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

const SESSION_FLAG_COOKIE = 'stockrsd_has_session';

function setSessionFlagCookie(present: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (present) {

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

  skipAuth?: boolean;

  skipBotToken?: boolean;
}

interface EnvelopeResult<TResponse> {
  data: TResponse;
  meta: PaginationMeta | undefined;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    return false;
  }
  refreshPromise ??= (async () => {
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
  return refreshPromise;
}

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

  try {
    headers['X-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl tidak tersedia (lingkungan sangat lawas) — biarkan tanpa
    // header ini, backend cuma jatuh balik ke "-" seperti sebelumnya.
  }

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

  if (response.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return executeRequest<TResponse>(path, options, true);
    }

    clearSession();
  }

  const rawEnvelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

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

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { data } = await executeRequest<TResponse>(path, options);
  return data;
}

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

  getPaginated: <T>(path: string, signal?: AbortSignal) =>
    apiRequestWithMeta<T[]>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

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

export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
})();

export function resolveUploadUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const resolvedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${resolvedPath}`;
}

export async function uploadFile<TResponse>(
  path: string,
  file: File,
  fieldName = 'file',
  extraFields?: Record<string, string>,
): Promise<TResponse> {
  async function attempt(isRetry: boolean): Promise<Response> {
    const accessToken = getAccessToken();
    const botToken = getBotToken();
    const formData = new FormData();
    if (extraFields) {
      Object.entries(extraFields).forEach(([key, value]) => formData.append(key, value));
    }
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (botToken) headers[BOT_TOKEN_HEADER] = botToken;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
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
