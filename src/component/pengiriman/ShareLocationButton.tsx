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

/**
 * Tombol untuk KURIR membagikan lokasi GPS-nya secara real-time — pakai
 * `navigator.geolocation.watchPosition` (API browser bawaan, bukan
 * hardware/app pihak ketiga) untuk memantau posisi perangkat, lalu kirim
 * update ke server setiap ~8 detik selama toggle ini aktif. Admin/dispatcher
 * yang membuka halaman yang sama akan melihat marker-nya bergerak lewat
 * LiveTrackingMap (polling GET .../lokasi).
 */
export function ShareLocationButton({ deliveryId }: ShareLocationButtonProps): React.JSX.Element {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);

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
    setIsSharing(false);
  }

  function startSharing(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Perangkat/browser ini tidak mendukung GPS (Geolocation API).');
      return;
    }
    setError(null);

    // Penggunaan Geolocation API di sini SENGAJA dan perlu (bukan
    // dipasang diam-diam): tombol ini eksplisit diberi label "Bagikan
    // Lokasi", hanya dirender untuk role karyawan/kurir (lihat
    // DeliveryDetail.tsx), dan browser SENDIRI akan menampilkan dialog
    // izin native ke user sebelum data lokasi apa pun terkirim -- ini
    // inti dari fitur live tracking pengiriman, bukan sekadar tracking
    // analitik. Ditandai eslint-disable karena SonarQube menandai
    // SEMUA pemanggilan geolocation untuk ditinjau manual (bukan
    // berarti otomatis salah), dan penggunaan ini sudah ditinjau.
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        // Throttle pengiriman ke server (browser bisa memicu callback ini
        // jauh lebih sering dari SEND_INTERVAL_MS) — cukup kirim satu kali
        // per interval, bukan setiap kali GPS device update posisinya.
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
    setIsSharing(true);
    toast.success('Lokasi kamu sekarang dibagikan secara real-time.');
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={isSharing ? 'danger' : 'primary'}
        onClick={isSharing ? stopSharing : startSharing}
      >
        {isSharing ? <NavigationOff className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
        {isSharing ? 'Berhenti Bagikan Lokasi' : 'Bagikan Lokasi Saya'}
      </Button>
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
    </div>
  );
}
