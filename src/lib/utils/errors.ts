import { HttpError } from '@/lib/api/client';

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

export const GENERIC_LOAD_ERROR =
  'Gagal memuat data — server backend tidak bisa dihubungi. Cek koneksi atau konfigurasi API.';

export function listErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  return friendlyError(error, GENERIC_LOAD_ERROR);
}
