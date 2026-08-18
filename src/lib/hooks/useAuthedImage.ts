import { useEffect, useState } from 'react';
import { fetchAuthedBlobUrl } from '@/lib/api/client';

/**
 * Muat gambar yang butuh login (mis. foto profil dari GET /users/:id/avatar
 * — lihat catatan panjang di `fetchAuthedBlobUrl`, client.ts) dan kembalikan
 * URL blob yang aman dipakai di `<img src>`.
 *
 * `path` adalah path relatif dari backend (mis. field `user.avatarUrl`,
 * berbentuk "/users/5/avatar?v=123"). Kosong/`undefined` berarti user belum
 * punya foto -> hook langsung balas `undefined` tanpa fetch, supaya
 * komponen pemanggil jatuh ke avatar inisial seperti biasa.
 *
 * Object URL lama SELALU di-revoke saat path berubah atau komponen
 * unmount, supaya tidak bocor memori tiap kali avatar diganti.
 */
export function useAuthedImage(path?: string | null): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sengaja reset avatar lama saat path berubah (mis. ganti user/upload foto baru), sebelum blob baru selesai di-fetch
    setBlobUrl(undefined);
    if (!path) {
      return undefined;
    }

    fetchAuthedBlobUrl(path)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url ?? undefined;
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        // Gagal muat (mis. token habis & refresh juga gagal) -> biarkan
        // undefined, komponen pemanggil jatuh ke avatar inisial daripada
        // menampilkan ikon gambar rusak.
        if (!cancelled) setBlobUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return blobUrl;
}
