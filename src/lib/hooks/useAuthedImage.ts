import { useEffect, useState } from 'react';
import { fetchAuthedBlobUrl } from '@/lib/api/client';

export function useAuthedImage(path?: string | null): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;

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

        if (!cancelled) setBlobUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return blobUrl;
}
