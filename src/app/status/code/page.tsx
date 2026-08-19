import { notFound } from 'next/navigation';
import { StatusScreen, type StatusCode } from '@/component/system/StatusScreen';

const VALID_CODES: StatusCode[] = ['400', '401', '403', '404', '408', '429', '500', '502', '503', '504'];

function isStatusCode(value: string): value is StatusCode {
  return (VALID_CODES as string[]).includes(value);
}

/**
 * Halaman generik `/status/:code` — satu tempat untuk semua kode status
 * yang mungkin perlu ditampilkan ke pengguna (401/403 dari proteksi
 * akses, 408/500/502/503/504 dari kegagalan memanggil backend, dst),
 * supaya desainnya konsisten di seluruh aplikasi. Dipakai oleh:
 *   - RoleGuard.tsx -> redirect ke /status/403 saat role tidak diizinkan
 *   - lib/api/client.ts -> redirect ke /status/50x saat backend gagal total
 *   - bisa juga dibuka manual untuk kebutuhan lain di masa depan
 * Kode yang tidak dikenali -> 404 asli (lihat not-found.tsx).
 */
export default async function StatusCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  if (!isStatusCode(code)) {
    notFound();
  }
  return <StatusScreen code={code} />;
}
