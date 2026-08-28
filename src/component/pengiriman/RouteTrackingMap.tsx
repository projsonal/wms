'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Route, Loader2 } from 'lucide-react';
import { deliveriesApi } from '@/lib/api/modules';

const POLL_INTERVAL_MS = 5000;

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });

interface RoadRoute {
  points: [number, number][];
  distanceKm: number;
  durationMin: number;
}

async function fetchRoadRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RoadRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates) return null;
  return {

    points: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}

interface RouteTrackingMapProps {
  deliveryId: string;
  courierName: string;
  originLabel: string;
  originCoord?: { lat: number; lng: number };
  destinationLabel: string;
  destinationCoord?: { lat: number; lng: number };

  fallbackCenter: { lat: number; lng: number };

  isDelivered?: boolean;

  onRouteComputed?: (route: { distanceKm: number; durationMin: number }) => void;
}

export function RouteTrackingMap({
  deliveryId,
  courierName,
  originLabel,
  originCoord,
  destinationLabel,
  destinationCoord,
  fallbackCenter,
  isDelivered = false,
  onRouteComputed,
}: RouteTrackingMapProps): React.JSX.Element {
  const [courierPos, setCourierPos] = useState<{ lat: number; lng: number } | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);

  const [roadRouteDestKey, setRoadRouteDestKey] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const autoFetchedKeyRef = useRef<string | null>(null);

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

    if (isDelivered) return;
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const res = await deliveriesApi.track(deliveryId);
        if (cancelled) return;
        if (typeof res.lat === 'number' && typeof res.lng === 'number' && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
          setCourierPos({ lat: res.lat, lng: res.lng });
          setRecordedAt(res.recordedAt);
        }
      } catch {
        // gagal diam-diam, coba lagi di tick berikutnya
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deliveryId, isDelivered]);

  const effectiveCourierPos = isDelivered && destinationCoord ? destinationCoord : courierPos;

  const destKey = destinationCoord ? `${destinationCoord.lat},${destinationCoord.lng}` : null;

  const activeRoadRoute = roadRouteDestKey === destKey ? roadRoute : null;

  async function handleShowRoute(): Promise<void> {
    const from = effectiveCourierPos ?? originCoord;
    if (!from || !destinationCoord) return;
    setIsLoadingRoute(true);
    setRouteError(null);
    try {
      const route = await fetchRoadRoute(from, destinationCoord);
      if (!route) {
        setRouteError('Rute tidak ditemukan (kemungkinan koordinat di luar jangkauan peta jalan).');
        return;
      }
      setRoadRoute(route);
      setRoadRouteDestKey(destKey);
      onRouteComputed?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });
    } catch {
      setRouteError('Gagal mengambil rute — coba lagi (server rute publik kadang sibuk).');
    } finally {
      setIsLoadingRoute(false);
    }
  }

  const straightPoints: [number, number][] = [];
  if (originCoord) straightPoints.push([originCoord.lat, originCoord.lng]);
  if (effectiveCourierPos) straightPoints.push([effectiveCourierPos.lat, effectiveCourierPos.lng]);
  if (destinationCoord) straightPoints.push([destinationCoord.lat, destinationCoord.lng]);

  const center = effectiveCourierPos ?? originCoord ?? destinationCoord ?? fallbackCenter;
  const hasAnyCoord = Boolean(originCoord || destinationCoord || effectiveCourierPos);
  const canShowRoute = Boolean((effectiveCourierPos ?? originCoord) && destinationCoord);

  useEffect(() => {
    if (!canShowRoute || isLoadingRoute) return;
    const autoKey = `${originCoord ? 'o' : 'c'}:${destKey}`;
    if (autoFetchedKeyRef.current === autoKey) return;
    autoFetchedKeyRef.current = autoKey;
    handleShowRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja cuma re-run saat canShowRoute/destKey berubah, bukan tiap courierPos bergeser (lihat catatan di atas)
  }, [canShowRoute, destKey]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative z-0 h-96 w-full overflow-hidden rounded-md border border-borderSoft">
        <MapContainer center={[center.lat, center.lng]} zoom={hasAnyCoord ? 12 : 10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RouteLine roadRoute={activeRoadRoute} straightPoints={straightPoints} />
          <RouteMarkers
            originCoord={originCoord}
            originLabel={originLabel}
            destinationCoord={destinationCoord}
            destinationLabel={destinationLabel}
            courierPos={effectiveCourierPos}
            courierName={courierName}
            recordedAt={recordedAt}
            isDelivered={isDelivered}
          />
        </MapContainer>
        <MapHint hasAnyCoord={hasAnyCoord} hasDestination={Boolean(destinationCoord)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleShowRoute}
          disabled={!canShowRoute || isLoadingRoute}
          title={canShowRoute ? 'Hitung ulang rute jalan dari OSRM' : 'Butuh koordinat asal/kurir DAN tujuan dulu'}
          className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 font-semibold text-text hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoadingRoute ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
          {isLoadingRoute ? 'Menghitung rute...' : 'Hitung Ulang Rute'}
        </button>
        {activeRoadRoute ? (
          <span className="text-textMuted">
            ≈ {activeRoadRoute.distanceKm.toFixed(1)} km · {Math.round(activeRoadRoute.durationMin)} menit (perkiraan jalan raya, motor/mobil)
          </span>
        ) : null}
        {routeError ? <span className="text-dangerText">{routeError}</span> : null}
      </div>
    </div>
  );
}

interface RouteLineProps {
  roadRoute: RoadRoute | null;
  straightPoints: [number, number][];
}

function RouteLine({ roadRoute, straightPoints }: RouteLineProps): React.JSX.Element | null {
  if (roadRoute) {
    return <Polyline positions={roadRoute.points} pathOptions={{ color: '#1d4ed8', weight: 5 }} />;
  }
  if (straightPoints.length >= 2) {
    return <Polyline positions={straightPoints} pathOptions={{ color: '#b45309', weight: 4, dashArray: '8 6' }} />;
  }
  return null;
}

interface RouteMarkersProps {
  originCoord?: { lat: number; lng: number };
  originLabel: string;
  destinationCoord?: { lat: number; lng: number };
  destinationLabel: string;
  courierPos: { lat: number; lng: number } | null;
  courierName: string;
  recordedAt: string | null;
  isDelivered: boolean;
}

function RouteMarkers({
  originCoord,
  originLabel,
  destinationCoord,
  destinationLabel,
  courierPos,
  courierName,
  recordedAt,
  isDelivered,
}: RouteMarkersProps): React.JSX.Element {
  return (
    <>
      {originCoord ? (
        <Marker position={[originCoord.lat, originCoord.lng]}>
          <Popup>
            <strong>Asal</strong>
            <br />
            {originLabel}
          </Popup>
        </Marker>
      ) : null}
      {destinationCoord ? (
        <Marker position={[destinationCoord.lat, destinationCoord.lng]}>
          <Popup>
            <strong>Tujuan</strong>
            <br />
            {destinationLabel}
          </Popup>
        </Marker>
      ) : null}
      {courierPos ? (
        <Marker position={[courierPos.lat, courierPos.lng]}>
          <Popup>
            <strong>{courierName}</strong>
            <br />
            {isDelivered ? (
              'Pengiriman selesai di sini'
            ) : (
              <>
                Posisi terakhir
                {recordedAt ? (
                  <>
                    <br />
                    {new Date(recordedAt).toLocaleTimeString('id-ID')}
                  </>
                ) : null}
              </>
            )}
          </Popup>
        </Marker>
      ) : null}
    </>
  );
}

function MapHint({ hasAnyCoord, hasDestination }: { hasAnyCoord: boolean; hasDestination: boolean }): React.JSX.Element | null {
  if (!hasAnyCoord) {
    return (
      <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-surface/90 px-3 py-1 text-center text-xs text-textMuted shadow-card">
        Belum ada koordinat sama sekali (asal/tujuan/kurir) — peta menampilkan lokasi default.
      </p>
    );
  }
  if (!hasDestination) {
    return (
      <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-surface/90 px-3 py-1 text-center text-xs text-textMuted shadow-card">
        Koordinat tujuan belum diisi — isi lewat form Ubah jadwal supaya rute lengkap tergambar.
      </p>
    );
  }
  return null;
}
