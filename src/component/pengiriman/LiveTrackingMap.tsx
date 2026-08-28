'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/component/ui/Card';
import { deliveriesApi } from '@/lib/api/modules';

const POLL_INTERVAL_MS = 5000;

function formatRecordedAt(recordedAt: string | null): string {
  return recordedAt ? new Date(recordedAt).toLocaleString('id-ID') : '-';
}

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

interface LiveTrackingMapProps {
  deliveryId: string;
  courierName: string;

  fallbackCenter: { lat: number; lng: number };
}

export function LiveTrackingMap({
  deliveryId,
  courierName,
  fallbackCenter,
}: LiveTrackingMapProps): React.JSX.Element {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [hasEverLocated, setHasEverLocated] = useState(false);

  useEffect(() => {
    import('leaflet').then((L) => {

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      try {
        const res = await deliveriesApi.track(deliveryId);
        if (cancelled) return;

        if (typeof res.lat === 'number' && typeof res.lng === 'number' && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
          setPosition({ lat: res.lat, lng: res.lng });
          setRecordedAt(res.recordedAt);
          setHasEverLocated(true);
        }
      } catch {
        // Polling diam-diam gagal (mis. koneksi putus sesaat) -> coba lagi di tick berikutnya.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deliveryId]);

  const center = position ?? (isValidCoord(fallbackCenter.lat, fallbackCenter.lng) ? fallbackCenter : null);

  return (
    <Card className="flex flex-col gap-2 p-0 overflow-hidden">
      <div className="h-96 w-full">
        {center ? (
          <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {position ? (
              <Marker position={[position.lat, position.lng]}>
                <Popup>
                  {courierName}
                  <br />
                  {recordedAt ? new Date(recordedAt).toLocaleTimeString('id-ID') : ''}
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutralBg px-4 text-center text-xs text-textMuted">
            Belum ada koordinat yang bisa ditampilkan — gudang asal belum diisi Latitude/Longitude dan
            kurir belum pernah mengirim posisi GPS.
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-xs text-textMuted">
        <span>
          {hasEverLocated ? `Update terakhir: ${formatRecordedAt(recordedAt)}` : 'Belum ada ping GPS dari kurir — peta menampilkan lokasi gudang asal.'}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-successText" />
          Live (polling tiap 5 detik)
        </span>
      </div>
    </Card>
  );
}
