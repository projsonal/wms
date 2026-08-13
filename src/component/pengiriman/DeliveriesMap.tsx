'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Delivery, Warehouse } from '@/types';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

interface DeliveriesMapProps {
  deliveries: Delivery[];
  /** Titik gudang yang punya koordinat (latitude/longitude) — dipetakan
   * dengan ikon terpisah dari marker kurir/pengiriman. Gudang tanpa
   * koordinat (belum diisi lewat form Tambah/Ubah Gudang) tidak muncul. */
  warehouses?: Warehouse[];
  /** Pusat peta default kalau belum ada satu pun delivery/gudang dengan koordinat. */
  fallbackCenter: { lat: number; lng: number };
}

/**
 * Peta Leaflet REAL (bukan placeholder statis) menampilkan:
 * 1. Titik lokasi setiap GUDANG yang sudah diisi koordinatnya (ikon gudang).
 * 2. Posisi terakhir setiap pengiriman aktif yang punya koordinat GPS
 *    (row.latitude/longitude — diisi dari ping terakhir ShareLocationButton
 *    lewat POST /pengiriman/:id/lokasi).
 * Dipakai di halaman Pickup & Dropoff supaya "Peta Pickup & Dropoff Aktif"
 * menunjukkan lokasi sungguhan, bukan titik persentase x/y statis.
 *
 * Dibungkus `relative z-0` supaya elemen internal Leaflet (yang punya
 * z-index sampai ~1000 lewat CSS bawaannya) tidak pernah bisa menembus ke
 * atas modal/dialog lain di halaman — itu membentuk stacking context baru
 * yang mengurung z-index Leaflet di dalam kotak peta ini saja.
 */
export function DeliveriesMap({ deliveries, warehouses = [], fallbackCenter }: DeliveriesMapProps): React.JSX.Element {
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

  const located = deliveries.filter(
    (d): d is Delivery & { latitude: number; longitude: number } =>
      typeof d.latitude === 'number' && typeof d.longitude === 'number',
  );
  const locatedWarehouses = warehouses.filter(
    (w): w is Warehouse & { latitude: number; longitude: number } =>
      typeof w.latitude === 'number' && typeof w.longitude === 'number',
  );

  const firstPoint = locatedWarehouses[0] ?? located[0];
  const center: [number, number] = firstPoint
    ? [firstPoint.latitude, firstPoint.longitude]
    : [fallbackCenter.lat, fallbackCenter.lng];

  return (
    <div className="relative z-0 h-[360px] w-full overflow-hidden rounded-md border border-borderSoft">
      <MapContainer center={center} zoom={located.length || locatedWarehouses.length ? 12 : 10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {locatedWarehouses.map((w) => (
          <Marker key={`gudang-${w.id}`} position={[w.latitude, w.longitude]}>
            <Popup>
              <strong>🏢 {w.name}</strong>
              <br />
              {w.address}
              {w.picName && w.picName !== '-' ? (
                <>
                  <br />
                  PIC: {w.picName}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
        {located.map((d) => (
          <Marker key={d.id} position={[d.latitude, d.longitude]}>
            <Popup>
              <strong>{d.code}</strong>
              <br />
              Kurir: {d.courierName || '-'}
              <br />
              Tujuan: {d.destination}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {located.length === 0 && locatedWarehouses.length === 0 ? (
        <p className="relative -mt-8 bg-surface/90 px-3 py-1 text-center text-xs text-textMuted">
          Belum ada gudang/pengiriman dengan koordinat — peta menampilkan lokasi default.
        </p>
      ) : null}
    </div>
  );
}
