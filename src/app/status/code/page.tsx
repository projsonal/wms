import { notFound } from 'next/navigation';
import { StatusScreen, type StatusCode } from '@/component/system/StatusScreen';

const VALID_CODES: StatusCode[] = ['400', '401', '403', '404', '408', '429', '500', '502', '503', '504'];

function isStatusCode(value: string): value is StatusCode {
  return (VALID_CODES as string[]).includes(value);
}

// Pesan khusus per "reason" (dikirim via query string oleh RoleGuard, mis.
// /status/403?reason=modul) supaya satu kode status (403) bisa menjelaskan
// beberapa penyebab berbeda tanpa perlu kode status baru.
const REASON_MESSAGE: Record<string, string> = {
  modul:
    'Kamu tidak bisa mengakses modul ini karena tidak dapat izin dari Kepala Gudang. Hubungi Kepala Gudang atau Super Admin kalau kamu merasa ini keliru.',
};

export default async function StatusCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ reason?: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  const { reason } = await searchParams;
  if (!isStatusCode(code)) {
    notFound();
  }
  const message = reason ? REASON_MESSAGE[reason] : undefined;
  return <StatusScreen code={code} message={message} />;
}
