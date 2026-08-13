import { HttpError } from '@/lib/api/client';

/**
 * Ubah error apa pun (dari panggilan API) jadi pesan yang aman ditampilkan
 * ke user. Kalau errornya `HttpError` (respons asli dari backend), pesan
 * dari server dipakai apa adanya. Selain itu (network error, backend tidak
 * terjangkau, dst.) pakai `fallback` yang diberikan pemanggil.
 *
 * Sebelumnya fungsi identik ini didefinisikan ulang di 11+ komponen
 * berbeda — disatukan di sini supaya perubahan/pembenaran cukup di satu
 * tempat (mis. menambah penanganan error jaringan generik).
 */
export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

/** Pesan generik dipakai `useResourceList`/list fetch saat error bukan
 * dari respons backend yang jelas (mis. backend tidak terjangkau sama
 * sekali / salah konfigurasi API base URL). */
export const GENERIC_LOAD_ERROR =
  'Gagal memuat data — server backend tidak bisa dihubungi. Cek koneksi atau konfigurasi API.';

/** Versi khusus untuk daftar/tabel: dipakai sebagai `errorMessage` DataTable. */
export function listErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  return friendlyError(error, GENERIC_LOAD_ERROR);
}
