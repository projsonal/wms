'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Navigation, NavigationOff } from 'lucide-react';
import { Button } from '@/component/ui/Button';
import { deliveriesApi } from '@/lib/api/modules';

const SEND_INTERVAL_MS = 8000;

interface ShareLocationButtonProps {
  deliveryId: string;
}

export function ShareLocationButton({ deliveryId }: ShareLocationButtonProps): React.JSX.Element {
  const [isSharing, setIsSharing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);

  const hasConfirmedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function stopSharing(): void {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRequesting(false);
    setIsSharing(false);
  }

  function startSharing(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Perangkat/browser ini tidak mendukung GPS (Geolocation API).');
      return;
    }
    setError(null);
    setIsRequesting(true);
    hasConfirmedRef.current = false;

    const id = navigator.geolocation.watchPosition(
      (pos) => {

        if (!hasConfirmedRef.current) {
          hasConfirmedRef.current = true;
          setIsRequesting(false);
          setIsSharing(true);
          toast.success('Lokasi kamu sekarang dibagikan secara real-time.');
        }
        const now = Date.now();

        if (now - lastSentAtRef.current < SEND_INTERVAL_MS) {
          return;
        }
        lastSentAtRef.current = now;
        deliveriesApi
          .sendLocation(deliveryId, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            kecepatanKmh: pos.coords.speed !== null ? pos.coords.speed * 3.6 : undefined,
          })
          .catch(() => {
            // Satu ping gagal terkirim bukan alasan menghentikan sharing —
            // ping berikutnya akan dicoba lagi otomatis.
          });
      },
      (geoError) => {
        setIsRequesting(false);
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Izin lokasi ditolak — aktifkan lewat pengaturan browser/HP untuk bagikan lokasi.'
            : 'Gagal membaca GPS, coba lagi.',
        );
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    watchIdRef.current = id;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={isSharing ? 'danger' : 'primary'}
        onClick={isSharing ? stopSharing : startSharing}
        disabled={isRequesting}
      >
        {isSharing ? <NavigationOff className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
        {(() => {
          if (isRequesting) return 'Meminta izin lokasi...';
          return isSharing ? 'Berhenti Bagikan Lokasi' : 'Bagikan Lokasi Saya';
        })()}
      </Button>
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
    </div>
  );
}
