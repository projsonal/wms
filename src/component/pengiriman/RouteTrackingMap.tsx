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

/**
 * Ambil rute JALAN SUNGGUHAN (mengikuti jalan raya, bukan garis lurus) dari
 * OSRM (Open Source Routing Machine) — server demo publik gratis milik
 * proyek OSRM sendiri, tidak perlu API key. Dipakai HANYA saat user
 * menekan tombol "Tampilkan Rute" (bukan otomatis), supaya tidak membebani
 * server publik itu dengan request otomatis tiap kali peta dibuka.
 *
 * Catatan jujur: ini server DEMO publik (bukan milik kita, bukan untuk
 * beban produksi tinggi) — cukup untuk kebutuhan "kasih gambaran rute ke
 * kurir", bukan pengganti Google Maps/Waze sungguhan. Kalau butuh lebih
 * andal, ganti URL_BASE dengan server OSRM sendiri atau layanan
 * berbayar (Mapbox/Google Directions).
 */
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
    // GeoJSON pakai urutan [lng, lat] — Leaflet butuh [lat, lng], jadi dibalik.
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
  /** Pusat peta default kalau TIDAK ADA satu pun koordinat yang valid
   * (asal, tujuan, maupun posisi kurir) — supaya peta tidak crash. */
  fallbackCenter: { lat: number; lng: number };
  /** true kalau dokumen pengiriman berstatus "terkirim" — lihat catatan
   * di RouteMarkers/effectiveCourierPos kenapa ini mengubah titik yang
   * ditampilkan sebagai posisi kurir. */
  isDelivered?: boolean;
  /** Dipanggil tiap kali rute jalan sungguhan (OSRM) berhasil dihitung —
   * dipakai StatCards di DeliveryDetail.tsx supaya kartu "Jarak Tempuh"
   * menampilkan angka HASIL PERHITUNGAN RUTE JALAN ini, bukan
   * `delivery.distanceKm` statis dari backend yang tidak pernah
   * ter-update (itu sebabnya sebelumnya selalu kelihatan "0 km" walau
   * rute sudah tergambar di peta). */
  onRouteComputed?: (route: { distanceKm: number; durationMin: number }) => void;
}

/**
 * Peta pelacakan LENGKAP — beda dari LiveTrackingMap.tsx lama yang cuma
 * menampilkan satu titik (posisi kurir/gudang asal): di sini digambar
 * marker ASAL, marker TUJUAN (kalau koordinatnya sudah diisi lewat form
 * Jadwalkan Pickup/Dropoff), marker POSISI KURIR live (polling tiap 5
 * detik), garis lurus asal→kurir→tujuan sebagai default, DAN rute jalan
 * sungguhan (lihat fetchRoadRoute, OSRM, profil "driving" — mengikuti
 * jalan raya yang bisa dilalui motor maupun mobil, bukan jalur pejalan
 * kaki) yang otomatis dihitung SEKALI begitu titik asal & tujuan
 * tersedia (lihat useEffect auto-fetch di bawah), menggantikan garis
 * lurus itu. Tombol "Tampilkan Rute" tetap ada untuk hitung ULANG manual
 * kalau kurir sudah jauh menyimpang dari rute awal.
 */
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
  // Koordinat tujuan yang dipakai SAAT roadRoute dihitung — dibandingkan
  // saat render (bukan lewat useEffect terpisah yang setState) supaya
  // rute basi otomatis diabaikan kalau koordinat tujuan berubah, tanpa
  // efek samping "setState di dalam effect" yang React anggap anti-pola.
  const [roadRouteDestKey, setRoadRouteDestKey] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  // Penanda "sudah pernah auto-fetch untuk kombinasi asal+tujuan INI" —
  // beda dari roadRouteDestKey (yang cuma lacak tujuan) karena auto-fetch
  // harus tepat SEKALI per kombinasi, tidak boleh nembak ulang tiap
  // courierPos bergeser sedikit dari polling 5 detik (baru itu yang
  // dianggap "membebani server publik tiap kali peta dibuka" — beda dari
  // 1x saat rute memang baru pertama kali bisa dihitung).
  const autoFetchedKeyRef = useRef<string | null>(null);

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
    // Sudah terkirim -> kurir sudah selesai & (lihat ShareLocationButton
    // di DeliveryDetail.tsx) tidak lagi membagikan lokasi, jadi polling
    // posisi live tidak berguna lagi -- titik akhir yang relevan adalah
    // titik TUJUAN (lihat effectiveCourierPos di bawah), bukan posisi GPS
    // terakhir yang mungkin terekam sedikit sebelum benar-benar sampai.
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

  // Sudah terkirim & titik tujuan sudah diisi -> anggap kurir "ada" di
  // titik tujuan (memenuhi permintaan: "titik koordinatnya muncul di
  // titik akhir" begitu pengiriman diselesaikan), bukan tetap menampilkan
  // posisi GPS terakhir yang mungkin meleset dari lokasi tujuan
  // sebenarnya. Kalau tujuan belum diisi koordinatnya, tetap pakai posisi
  // GPS terakhir yang sempat terekam sebagai fallback.
  const effectiveCourierPos = isDelivered && destinationCoord ? destinationCoord : courierPos;

  const destKey = destinationCoord ? `${destinationCoord.lat},${destinationCoord.lng}` : null;
  // Rute basi (dihitung untuk tujuan yang berbeda dari sekarang) diabaikan
  // saat render, bukan dibersihkan lewat effect terpisah.
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

  // Auto-hitung rute jalan SEKALI begitu titik asal/kurir & tujuan
  // sama-sama tersedia — memenuhi permintaan "otomatis diarahkan rute",
  // tapi tetap dijaga supaya tidak menembak OSRM berulang-ulang tiap
  // courierPos bergeser dikit dari polling 5 detik: kunci
  // autoFetchedKeyRef dari kombinasi titik AWAL saja (originCoord kalau
  // ada, atau "courier" generik), bukan posisi live yang terus berubah —
  // begitu kombinasi asal+tujuan pernah di-auto-fetch, tidak akan
  // nembak ulang otomatis lagi (tombol "Tampilkan Rute" tetap bisa
  // dipakai manual kapan saja untuk hitung ulang).
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
