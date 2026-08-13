'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/component/ui/Card';
import { deliveriesApi } from '@/lib/api/modules';

const POLL_INTERVAL_MS = 5000;

/** Format "-" kalau belum ada timestamp, else waktu lengkap lokal ID. */
function formatRecordedAt(recordedAt: string | null): string {
  return recordedAt ? new Date(recordedAt).toLocaleString('id-ID') : '-';
}

/** true hanya kalau kedua nilai benar-benar angka valid (bukan NaN/undefined/
 * null) — Leaflet melempar "Invalid LatLng object" tanpa fallback yang jelas
 * kalau salah satu koordinat undefined, jadi ini WAJIB dicek sebelum render
 * MapContainer maupun sebelum menyimpan posisi baru ke state. */
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
  /** Fallback kalau belum pernah ada ping GPS sama sekali (pusatkan peta
   * di sini, mis. lokasi gudang asal). */
  fallbackCenter: { lat: number; lng: number };
}

/**
 * Peta pelacakan REAL-TIME — polling GET /pengiriman/:id/lokasi tiap 5
 * detik dan menampilkan posisi GPS kurir yang sesungguhnya (bukan titik
 * persentase statis seperti MapPlaceholder sebelumnya). Marker otomatis
 * pindah setiap ada ping baru dari ShareLocationButton di perangkat kurir.
 */
export function LiveTrackingMap({
  deliveryId,
  courierName,
  fallbackCenter,
}: LiveTrackingMapProps): React.JSX.Element {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [hasEverLocated, setHasEverLocated] = useState(false);

  // Perbaikan untuk masalah umum react-leaflet+Next.js: ikon marker
  // default Leaflet mereferensikan path relatif ke modulnya sendiri yang
  // rusak setelah di-bundle webpack/Turbopack (ikon jadi tidak muncul
  // sama sekali tanpa error jelas). Timpa manual dengan URL CDN.
  useEffect(() => {
    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- properti internal Leaflet, tidak ada di typing publik
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
        // Cek numerik penuh (bukan cuma `!== null`) — respons API bisa saja
        // punya field yang hilang/undefined kalau ada perubahan bentuk
        // response di backend; itu HARUS dianggap "belum ada posisi",
        // bukan diteruskan mentah ke MapContainer sampai bikin crash.
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

  // fallbackCenter juga divalidasi — kalau pemanggil kebetulan mengirim
  // gudang yang belum diisi koordinat (latitude/longitude opsional di
  // Warehouse, lihat types/index.ts), jangan sampai ikut merender peta
  // dengan koordinat undefined juga.
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
