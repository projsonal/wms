'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { X, Pencil, Trash2, Network, History, AlertTriangle, BellRing, BellOff, Radio, MapPinned, Boxes, Users, Menu, Map as MapIcon, List } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Badge } from '@/component/ui/Badge';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { ASSET_STATUS_META } from '@/lib/utils/status';
import { resolveGudangLabel } from '@/lib/utils/gudang-labels';
import { assetsApi, assetPortApi, assetHistoryApi, itemsApi, type AssetMapPoint, type AssetPortItem, type AssetHistoryEntry } from '@/lib/api/modules';
import { friendlyError } from '@/lib/utils/errors';
import { formatBulanTahun } from '@/lib/utils/period-grouping';
import type { JenisAset, AssetStatus, Asset } from '@/types';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then((m) => m.ZoomControl), { ssr: false });

const JENIS_MARKER_META: Record<string, { abbr: string; color: string; label: string }> = {
  tiang: { abbr: 'TG', color: '#78350f', label: 'Tiang' },
  odc: { abbr: 'ODC', color: '#b5451b', label: 'ODC' },
  ont: { abbr: 'ONT', color: '#2563eb', label: 'ONT' },
  odp: { abbr: 'ODP', color: '#059669', label: 'ODP' },
  olt: { abbr: 'OLT', color: '#7c3aed', label: 'OLT' },
  modem: { abbr: 'MDM', color: '#d97706', label: 'Modem' },
  transportasi: { abbr: 'TR', color: '#6b7280', label: 'Transportasi' },
};

// 'transportasi' sengaja TIDAK dimasukkan di sini — aset transportasi
// (kendaraan) tidak punya titik koordinat tetap (lihat
// model.JenisAsetPunyaKoordinat di backend) karena posisinya berubah-ubah
// dan baru bisa dilacak real-time kalau kendaraannya dipasangi sensor
// GPS, bukan lewat penunjukan titik manual seperti tiang/ODC/dst. Jadi
// peta/tracking ini memang khusus aset berkoordinat tetap.
const JENIS_URUTAN: JenisAset[] = ['tiang', 'odc', 'ont', 'odp', 'olt'];
const STATUS_URUTAN: AssetStatus[] = ['aktif', 'rusak', 'nonaktif'];

function formatMarkerLabel(point: AssetMapPoint): string {
  const match = new RegExp(/-RSD-(\d+)$/i).exec(point.labelRsd);
  const noUrut = match ? match[1] : point.labelRsd;
  const tipeLabel = point.gudangTipe === 'pusat' ? 'kantor pusat' : 'kantor cabang';
  return `${point.gudangNama.toLowerCase()}(${tipeLabel}) - RSD - ${noUrut}`;
}

function playAlarmBeep(): void {
  try {

    const Ctx: any = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    window.setTimeout(() => ctx.close(), 500);
  } catch {
    // Diamkan — alarm visual (badge merah, marker berdenyut) tetap tampil
    // walau bunyi gagal diputar.
  }
}

function AssetTrackingMapBody(): React.JSX.Element {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';

  const [allPoints, setAllPoints] = useState<AssetMapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleJenis, setVisibleJenis] = useState<Set<JenisAset>>(new Set(JENIS_URUTAN));
  const [statusFilter, setStatusFilter] = useState<AssetStatus | null>(null);
  const [showCable, setShowCable] = useState(true);

  const [viewMode, setViewMode] = useState<'peta' | 'sederhana'>('peta');

  // Tab Infrastruktur/Transportasi KHUSUS di tab "Sederhana" — sengaja
  // dipisah dari `allPoints`/loadPoints di atas: itu datanya dari
  // assetsApi.map() yang MEMANG cuma berisi aset berkoordinat tetap (jaringan),
  // aset transportasi (kendaraan) tidak pernah ada di situ (lihat komentar
  // JENIS_URUTAN). Supaya tab "Sederhana" bisa menyamai pemisahan yang sudah
  // ada di menu Manajemen Aset Barang (Infrastruktur vs Transportasi), data
  // transportasi dimuat terpisah lewat assetsApi.list() biasa (bukan .map()),
  // dan HANYA dipakai di tampilan Sederhana — tab "Peta" tidak tersentuh sama
  // sekali oleh perubahan ini.
  const [sederhanaTab, setSederhanaTab] = useState<'infrastruktur' | 'transportasi'>('infrastruktur');
  const [transportasiAssets, setTransportasiAssets] = useState<Asset[]>([]);
  const [isLoadingTransportasi, setIsLoadingTransportasi] = useState(false);
  const [hasLoadedTransportasi, setHasLoadedTransportasi] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<AssetMapPoint | null>(null);
  const [showPortPanel, setShowPortPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const [alarmMuted, setAlarmMuted] = useState(false);
  const knownDownIdsRef = useRef<Set<number> | null>(null);

  const [liveClock, setLiveClock] = useState('');
  const [totalBarang, setTotalBarang] = useState<number | null>(null);

  const [leafletIcons, setLeafletIcons] = useState<Record<string, any> | null>(null);

  const [leafletIconsDown, setLeafletIconsDown] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    import('leaflet').then((L) => {
      const icons: Record<string, L.DivIcon> = {};
      const iconsDown: Record<string, L.DivIcon> = {};
      Object.keys(JENIS_MARKER_META).forEach((jenis) => {
        const meta = JENIS_MARKER_META[jenis];
        icons[jenis] = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${meta.color};color:#fff;font-size:9px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);">${meta.abbr}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17],
        });
        iconsDown[jenis] = L.divIcon({
          className: '',
          html: `<div class="animate-wms-alarm-pulse" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${meta.color};color:#fff;font-size:9px;font-weight:700;border:2px solid #dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.55),0 1px 4px rgba(0,0,0,.35);">${meta.abbr}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17],
        });
      });

      setLeafletIcons(icons);

      setLeafletIconsDown(iconsDown);
    });
  }, []);

  async function loadPoints(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await assetsApi.map();
      setAllPoints(res);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat titik lokasi aset.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshPointsSilently(): Promise<void> {
    try {
      const res = await assetsApi.map();
      setAllPoints(res);
    } catch {
      // Diamkan — kegagalan polling latar belakang tidak perlu toast
      // berulang tiap 20 detik, cukup coba lagi di siklus berikutnya.
    }
  }

  useEffect(() => {

    loadPoints();
  }, []);

  useEffect(() => {
    if (sederhanaTab !== 'transportasi' || hasLoadedTransportasi) {
      return;
    }
    let cancelled = false;
    setIsLoadingTransportasi(true);
    assetsApi
      .list({ pageSize: 500 })
      .then((res) => {
        if (cancelled) return;
        setTransportasiAssets(res.data.filter((a) => a.jenisAset === 'transportasi'));
        setHasLoadedTransportasi(true);
      })
      .catch(() => {
        if (!cancelled) toast.error('Gagal memuat data aset transportasi.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTransportasi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sederhanaTab, hasLoadedTransportasi]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshPointsSilently();
    }, 20000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentDownIds = new Set(
      allPoints.filter((p) => p.status === 'rusak').map((p) => p.id),
    );
    if (knownDownIdsRef.current) {
      const newlyDown = allPoints.filter(
        (p) => p.status === 'rusak' && !knownDownIdsRef.current!.has(p.id),
      );
      if (newlyDown.length > 0) {
        if (!alarmMuted) playAlarmBeep();
        newlyDown.forEach((p) => {
          toast.error(`⚠ ${p.labelRsd} ditandai RUSAK — perlu tindakan.`);
        });
      }
    }
    knownDownIdsRef.current = currentDownIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja cuma reaktif ke allPoints; alarmMuted dibaca lewat closure terbaru tiap render
  }, [allPoints]);

  const downPoints = useMemo(() => allPoints.filter((p) => p.status === 'rusak'), [allPoints]);

  useEffect(() => {
    function tick(): void {
      setLiveClock(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      );
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    itemsApi
      .list({ pageSize: 1 })
      .then((res) => setTotalBarang(res.total))
      .catch(() => setTotalBarang(null));
  }, []);

  const liveStats = useMemo(() => {
    const totalPelangganPort = allPoints.reduce((sum, p) => sum + (p.portTerisi ?? 0), 0);

    const aktifCount = allPoints.filter((p) => p.status === 'aktif').length;
    const aktifPct = allPoints.length > 0 ? (aktifCount / allPoints.length) * 100 : null;
    return {
      totalPeta: allPoints.length,
      totalPelangganPort,
      aktifPct,
    };
  }, [allPoints]);

  const points = useMemo(
    () =>
      allPoints.filter(
        (p) => visibleJenis.has(p.jenisAset) && (!statusFilter || p.status === statusFilter),
      ),
    [allPoints, visibleJenis, statusFilter],
  );

  const countByJenis = useMemo(() => {
    const counts: Partial<Record<JenisAset, number>> = {};
    allPoints.forEach((p) => {
      counts[p.jenisAset] = (counts[p.jenisAset] ?? 0) + 1;
    });
    return counts;
  }, [allPoints]);

  const countByStatus = useMemo(() => {
    const counts: Partial<Record<AssetStatus, number>> = {};
    allPoints.forEach((p) => {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    });
    return counts;
  }, [allPoints]);

  function toggleJenis(jenis: JenisAset): void {
    setVisibleJenis((prev) => {
      const next = new Set(prev);
      if (next.has(jenis)) next.delete(jenis);
      else next.add(jenis);
      return next;
    });
  }

  async function handleDelete(point: AssetMapPoint): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Aset',
      message: `Hapus "${point.nama}" (${point.labelRsd})? Data akan masuk Tempat Sampah dan bisa dipulihkan lewat ikon di header.`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await assetsApi.remove(String(point.id));
      toast.success('Aset berhasil dihapus.');
      setSelectedPoint(null);
      await loadPoints();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus aset.'));
    }
  }

  const firstPoint = points[0];
  const center: [number, number] = firstPoint ? [firstPoint.latitude, firstPoint.longitude] : [-6.9147, 107.6098];
  let aktifIconClass = 'text-textMuted';
  if (liveStats.aktifPct !== null) {
    if (liveStats.aktifPct >= 95) {
      aktifIconClass = 'text-successText';
    } else if (liveStats.aktifPct >= 80) {
      aktifIconClass = 'text-amber-600';
    } else {
      aktifIconClass = 'text-dangerText';
    }
  }

  return (
    <PageShell title="Tracking Aset" breadcrumb="Manajemen / Tracking Aset">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Titik Aset', value: allPoints.length },
          ...STATUS_URUTAN.map((s) => ({
            id: s,
            label: ASSET_STATUS_META[s].label,
            value: countByStatus[s] ?? 0,
          })),
        ]}
      />

      {downPoints.length > 0 ? (
        <div className="mt-4 rounded-lg border border-dangerText/30 bg-dangerBg/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-dangerText">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-bold">
                {downPoints.length} aset berstatus RUSAK — perlu tindak lanjut
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAlarmMuted((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full border border-dangerText/40 bg-panel px-3 py-1 text-xs font-semibold text-dangerText hover:bg-dangerBg"
              title={alarmMuted ? 'Nyalakan bunyi alarm' : 'Bisukan bunyi alarm'}
            >
              {alarmMuted ? <BellOff className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
              {alarmMuted ? 'Alarm Dibisukan' : 'Alarm Aktif'}
            </button>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-dangerText/15">
            {downPoints.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPoint(p);
                  setShowPortPanel(false);
                  setShowHistoryPanel(false);
                }}
                className="flex items-center justify-between gap-3 py-2 text-left text-xs hover:bg-panel/60"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-dangerText" />
                  <span className="font-semibold text-text">{formatMarkerLabel(p)}</span>
                  <span className="text-textMuted">({p.gudangNama})</span>
                </span>
                <span className="text-dangerText">Rusak</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-1 rounded-full bg-neutralBg p-1 text-xs w-fit">
        <button
          type="button"
          onClick={() => setViewMode('peta')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors ${
            viewMode === 'peta' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" /> Peta
        </button>
        <button
          type="button"
          onClick={() => setViewMode('sederhana')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors ${
            viewMode === 'sederhana' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
          }`}
        >
          <List className="h-3.5 w-3.5" /> Sederhana
        </button>
      </div>

      {viewMode === 'sederhana' ? (
        <>
          {/*
            Sesuai pemisahan yang sudah ada di menu Manajemen Aset Barang:
            Infrastruktur (aset jaringan berkoordinat tetap — Tiang/ODC/ONT/
            ODP/OLT) vs Transportasi (kendaraan, tidak berkoordinat). Tab
            "Peta" tidak punya konsep ini karena memang cuma menampilkan aset
            berkoordinat.
          */}
          <div className="mt-4 flex items-center gap-1 rounded-full bg-neutralBg p-1 text-xs w-fit">
            <button
              type="button"
              onClick={() => setSederhanaTab('infrastruktur')}
              className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                sederhanaTab === 'infrastruktur' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
              }`}
            >
              Infrastruktur
            </button>
            <button
              type="button"
              onClick={() => setSederhanaTab('transportasi')}
              className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                sederhanaTab === 'transportasi' ? 'bg-accent text-white' : 'text-textMuted hover:text-text'
              }`}
            >
              Transportasi
            </button>
          </div>

          {sederhanaTab === 'infrastruktur' ? (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
              <HierarchyPanel
                points={allPoints}
                selectedId={selectedPoint?.id ?? null}
                onSelect={(p) => {
                  setSelectedPoint(p);
                  setShowPortPanel(false);
                }}
              />
              <DetailTrackingTable
                points={allPoints}
                selectedId={selectedPoint?.id ?? null}
                onSelect={(p) => {
                  setSelectedPoint(p);
                  setShowPortPanel(false);
                }}
              />
            </div>
          ) : (
            <div className="mt-4">
              <TransportasiTrackingTable assets={transportasiAssets} isLoading={isLoadingTransportasi} />
            </div>
          )}
        </>
      ) : (

        <div className="relative mt-4">
          <Card className="relative z-0 overflow-hidden p-0">
            {leafletIcons ? (
              <MapContainer
                center={center}
                zoom={points.length ? 12 : 6}
                zoomControl={false}
                style={{ height: 'calc(100vh - 260px)', minHeight: '520px', width: '100%' }}
              >
                <ZoomControl position="bottomright" />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {showCable &&
                  points.map((point) => {
                    let target: { lat: number; lng: number; dashed: boolean } | null = null;
                    if (point.parentAssetId && point.parentLatitude != null && point.parentLongitude != null) {
                      target = { lat: point.parentLatitude, lng: point.parentLongitude, dashed: false };
                    } else if (point.gudangLatitude != null && point.gudangLongitude != null) {
                      target = { lat: point.gudangLatitude, lng: point.gudangLongitude, dashed: true };
                    }
                    if (!target) return null;
                    return (
                      <Polyline
                        key={`cable-${point.id}`}
                        positions={[[point.latitude, point.longitude], [target.lat, target.lng]]}
                        pathOptions={{
                          color: target.dashed ? '#94a3b8' : '#0f766e',
                          weight: 2,
                          dashArray: target.dashed ? '4 6' : undefined,
                        }}
                      />
                    );
                  })}
                {points.map((point) => (
                  <Marker
                    key={point.id}
                    position={[point.latitude, point.longitude]}
                    icon={
                      point.status === 'rusak'
                        ? (leafletIconsDown?.[point.jenisAset] ?? leafletIcons[point.jenisAset] ?? leafletIcons.tiang)
                        : (leafletIcons[point.jenisAset] ?? leafletIcons.tiang)
                    }
                    eventHandlers={{
                      click: () => {
                        setSelectedPoint(point);
                        setShowPortPanel(false);
                        setShowHistoryPanel(false);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -17]}>
                      {formatMarkerLabel(point)}
                      {point.status === 'rusak' ? ' — ⚠ RUSAK' : ''}
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="flex items-center justify-center text-sm text-textMuted" style={{ height: '520px' }}>
                Memuat peta...
              </div>
            )}

            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="absolute left-3 top-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-md bg-surface text-text shadow-card hover:bg-neutralBg"
              title={sidebarOpen ? 'Sembunyikan panel' : 'Tampilkan panel'}
            >
              <Menu className="h-4 w-4" />
            </button>

            {sidebarOpen ? (
              <div className="absolute left-3 top-16 z-[999] flex max-h-[calc(100%-11rem)] w-72 flex-col gap-3 overflow-y-auto rounded-lg bg-surface p-3 shadow-card">
                <Card className="flex flex-col gap-4 border-0 p-0 shadow-none">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-textMuted">Layer</h3>
                    <div className="flex flex-col gap-1.5">
                      {JENIS_URUTAN.map((jenis) => {
                        const meta = JENIS_MARKER_META[jenis];
                        const active = visibleJenis.has(jenis);
                        return (
                          <button
                            key={jenis}
                            type="button"
                            onClick={() => toggleJenis(jenis)}
                            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                              active ? 'bg-neutralBg text-text' : 'text-textMuted opacity-50 hover:opacity-80'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                style={{ background: meta.color }}
                              >
                                {meta.abbr[0]}
                              </span>
                              {meta.label}
                            </span>
                            <span className="font-semibold">{countByJenis[jenis] ?? 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-borderSoft pt-3">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-textMuted">Status</h3>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatusFilter(null)}
                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                          statusFilter === null ? 'bg-neutralBg text-text' : 'text-textMuted hover:bg-neutralBg'
                        }`}
                      >
                        <span>Semua Status</span>
                        <span className="font-semibold">{allPoints.length}</span>
                      </button>
                      {STATUS_URUTAN.map((s) => {
                        const meta = ASSET_STATUS_META[s];
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                              statusFilter === s ? 'bg-neutralBg text-text' : 'text-textMuted hover:bg-neutralBg'
                            }`}
                          >
                            <Badge label={meta.label} variant={meta.variant} />
                            <span className="font-semibold">{countByStatus[s] ?? 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-borderSoft pt-3">
                    <label className="flex items-center gap-2 text-xs text-textMuted">
                      <input type="checkbox" checked={showCable} onChange={(e) => setShowCable(e.target.checked)} />
                      Tampilkan garis kabel
                    </label>
                    <div className="mt-2 flex flex-col gap-1 pl-1 text-[11px] text-textMuted">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 bg-accent" /> Hierarki jaringan (ke aset induk)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 border-t border-dashed border-slate-400" /> Ke gudang (belum ada induk)
                      </span>
                    </div>
                  </div>
                </Card>

                <HierarchyPanel
                  points={allPoints}
                  selectedId={selectedPoint?.id ?? null}
                  onSelect={(p) => {
                    setSelectedPoint(p);
                    setShowPortPanel(false);
                  }}
                />
              </div>
            ) : null}

            <div className="absolute bottom-3 left-3 right-3 z-[999] flex flex-col gap-3 rounded-lg bg-surface p-3 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-textMuted">Status · Live</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-textMuted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-successText" />
                  {liveClock}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-2 rounded-md border border-borderSoft px-3 py-2">
                  <MapPinned className="h-4 w-4 flex-shrink-0 text-accentDark" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-textMuted">Peta</span>
                    <span className="text-sm font-bold text-text">{liveStats.totalPeta} titik</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-borderSoft px-3 py-2">
                  <Users className="h-4 w-4 flex-shrink-0 text-accentDark" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-textMuted">Pelanggan</span>
                    <span className="text-sm font-bold text-text">{liveStats.totalPelangganPort} tersambung</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-borderSoft px-3 py-2">
                  <Radio
                    className={`h-4 w-4 flex-shrink-0 ${aktifIconClass}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-textMuted">Aset Aktif</span>
                    <span className="text-sm font-bold text-text">
                      {liveStats.aktifPct === null ? 'Belum ada aset' : `${liveStats.aktifPct.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
                <a
                  href="/kelola-barang"
                  className="flex items-center gap-2 rounded-md border border-borderSoft px-3 py-2 transition-colors hover:border-accent"
                >
                  <Boxes className="h-4 w-4 flex-shrink-0 text-accentDark" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-textMuted">Aset Barang</span>
                    <span className="text-sm font-bold text-text">
                      {totalBarang === null ? '—' : `${totalBarang} SKU`}
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </Card>

          {isLoading ? <p className="mt-2 text-xs text-textMuted">Memuat titik aset...</p> : null}
        </div>
      )}

      {selectedPoint ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">{formatMarkerLabel(selectedPoint)}</h3>
              <p className="text-xs text-textMuted">
                {JENIS_MARKER_META[selectedPoint.jenisAset]?.label ?? selectedPoint.jenisAset} · {selectedPoint.nama}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoint(null)}
              aria-label="Tutup"
              className="text-textMuted hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={ASSET_STATUS_META[selectedPoint.status].label}
              variant={ASSET_STATUS_META[selectedPoint.status].variant}
            />
          </div>

          <div className="grid grid-cols-1 gap-1 text-xs text-textMuted sm:grid-cols-2">
            <p>Gudang: {selectedPoint.gudangNama} ({resolveGudangLabel(selectedPoint.gudangKode)})</p>
            <p>Koordinat: {selectedPoint.latitude}, {selectedPoint.longitude}</p>
            {selectedPoint.merek || selectedPoint.tipe ? (
              <p>Merek / Tipe: {[selectedPoint.merek, selectedPoint.tipe].filter(Boolean).join(' ')}</p>
            ) : null}
            {selectedPoint.kodeBarang ? <p>Kode Barang: <span className="font-mono">{selectedPoint.kodeBarang}</span></p> : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-borderSoft pt-3">
            <button
              type="button"
              onClick={() => setShowHistoryPanel((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 text-xs font-semibold text-text hover:border-accent"
            >
              <History className="h-3.5 w-3.5" /> Riwayat
            </button>
            {(selectedPoint.jumlahPort ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => setShowPortPanel((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 text-xs font-semibold text-text hover:border-accent"
              >
                <Network className="h-3.5 w-3.5" /> Kelola Port ({selectedPoint.portTerisi ?? 0} dari {selectedPoint.jumlahPort})
              </button>
            ) : null}
            <a
              href="/aset-gudang"
              className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 text-xs font-semibold text-text hover:border-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Ubah di Manajemen Aset
            </a>
            {isStaff ? (
              <button
                type="button"
                onClick={() => handleDelete(selectedPoint)}
                className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 text-xs font-semibold text-dangerText hover:border-dangerText"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            ) : null}
          </div>

          {showPortPanel && (selectedPoint.jumlahPort ?? 0) > 0 ? (
            <PortManagementPanel
              asset={selectedPoint}
              allPoints={allPoints}
              onPortsChanged={loadPoints}
            />
          ) : null}
          {showHistoryPanel ? <AssetHistoryPanel assetId={selectedPoint.id} /> : null}
        </Card>
      ) : null}
    </PageShell>
  );
}

export function AssetTrackingMapContent(): React.JSX.Element {
  return <AssetTrackingMapBody />;
}

interface TreeNode {
  point: AssetMapPoint | null;
  key: string;
  label: string;
  children: TreeNode[];
}

function buildHierarchyTree(points: AssetMapPoint[]): TreeNode[] {
  const byParent = new Map<number, AssetMapPoint[]>();
  const byId = new Map<number, AssetMapPoint>();
  points.forEach((p) => byId.set(p.id, p));
  points.forEach((p) => {
    if (p.parentAssetId != null && byId.has(p.parentAssetId)) {
      const list = byParent.get(p.parentAssetId) ?? [];
      list.push(p);
      byParent.set(p.parentAssetId, list);
    }
  });

  function toNode(p: AssetMapPoint): TreeNode {
    const children = (byParent.get(p.id) ?? []).map(toNode);
    return { point: p, key: `a-${p.id}`, label: `${p.jenisAset.toUpperCase()} ${p.labelRsd}`, children };
  }

  const roots = points.filter((p) => p.parentAssetId == null || !byId.has(p.parentAssetId));
  const byGudang = new Map<number, { nama: string; kode: string; items: AssetMapPoint[] }>();
  roots.forEach((p) => {
    const g = byGudang.get(p.gudangId) ?? { nama: p.gudangNama, kode: p.gudangKode, items: [] };
    g.items.push(p);
    byGudang.set(p.gudangId, g);
  });

  return Array.from(byGudang.entries()).map(([gudangId, g]) => ({
    point: null,
    key: `g-${gudangId}`,
    label: `${g.nama} (${resolveGudangLabel(g.kode)})`,
    children: g.items.map(toNode),
  }));
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function TreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: Readonly<{
  node: TreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (p: AssetMapPoint) => void;
}>): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = node.point ? node.point.id === selectedId : false;
  const meta = node.point ? JENIS_MARKER_META[node.point.jenisAset] : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setExpanded((prev) => !prev);
          if (node.point) onSelect(node.point);
        }}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        className={`flex w-full items-center justify-between gap-2 rounded-md py-1 pr-2 text-left text-[11px] transition-colors ${
          isSelected ? 'bg-neutralBg text-text' : 'text-textMuted hover:bg-neutralBg'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {hasChildren ? <span className="w-3 shrink-0 text-[9px]">{expanded ? '▾' : '▸'}</span> : <span className="w-3 shrink-0" />}
          {meta ? (
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
              style={{ background: meta.color }}
            >
              {meta.abbr[0]}
            </span>
          ) : null}
          <span className="truncate">{node.label}</span>
        </span>
        {hasChildren ? <span className="shrink-0 font-semibold">{countDescendants(node)}</span> : null}
      </button>
      {hasChildren && expanded ? (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.key} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailTrackingTable({
  points,
  selectedId,
  onSelect,
}: Readonly<{
  points: AssetMapPoint[];
  selectedId: number | null;
  onSelect: (p: AssetMapPoint) => void;
}>): React.JSX.Element {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.gudangNama.localeCompare(b.gudangNama) || a.nama.localeCompare(b.nama)),
    [points],
  );

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-xs text-textMuted">Belum ada aset berkoordinat untuk dilacak.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-borderSoft bg-neutralBg/60 text-[10px] uppercase tracking-wide text-textMuted">
          <tr>
            <th className="px-3 py-2 font-semibold">Nama / Label</th>
            <th className="px-3 py-2 font-semibold">Jenis</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Gudang</th>
            <th className="px-3 py-2 font-semibold">Merek / Tipe</th>
            <th className="px-3 py-2 font-semibold">Kode Barang</th>
            <th className="px-3 py-2 font-semibold">Port</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const meta = JENIS_MARKER_META[p.jenisAset];
            const statusMeta = ASSET_STATUS_META[p.status];
            const isSelected = p.id === selectedId;
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`cursor-pointer border-b border-borderSoft/60 transition-colors last:border-b-0 ${
                  isSelected ? 'bg-neutralBg' : 'hover:bg-neutralBg/60'
                }`}
              >
                <td className="px-3 py-2">
                  <p className="font-semibold text-text">{p.nama}</p>
                  <p className="font-mono text-[10px] text-textMuted">{p.labelRsd || '-'}</p>
                </td>
                <td className="px-3 py-2">
                  {meta ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: meta.color }}
                    >
                      {meta.label}
                    </span>
                  ) : (
                    p.jenisAset
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge label={statusMeta.label} variant={statusMeta.variant} />
                </td>
                <td className="px-3 py-2 text-textMuted">{p.gudangNama}</td>
                <td className="px-3 py-2 text-textMuted">
                  {[p.merek, p.tipe].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-textMuted">{p.kodeBarang || '-'}</td>
                <td className="px-3 py-2 text-textMuted">
                  {(p.jumlahPort ?? 0) > 0 ? `${p.portTerisi ?? 0} / ${p.jumlahPort}` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// Tabel sederhana untuk tab "Transportasi" — kolomnya beda dari
// DetailTrackingTable (jaringan) karena data yang relevan buat kendaraan juga
// beda (Nopol/Jenis Kendaraan/Tahun, bukan Port/Kode Barang), mengikuti
// kolom "Data Transportasi" yang sama seperti di menu Manajemen Aset Barang.
function TransportasiTrackingTable({
  assets,
  isLoading,
}: Readonly<{ assets: Asset[]; isLoading: boolean }>): React.JSX.Element {
  const sorted = useMemo(
    () => [...assets].sort((a, b) => a.gudangNama.localeCompare(b.gudangNama) || a.nama.localeCompare(b.nama)),
    [assets],
  );

  if (isLoading) {
    return (
      <Card>
        <p className="text-xs text-textMuted">Memuat data aset transportasi...</p>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-xs text-textMuted">Belum ada aset transportasi yang terdaftar.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-borderSoft bg-neutralBg/60 text-[10px] uppercase tracking-wide text-textMuted">
          <tr>
            <th className="px-3 py-2 font-semibold">Nama</th>
            <th className="px-3 py-2 font-semibold">Nomor Polisi</th>
            <th className="px-3 py-2 font-semibold">Jenis Kendaraan</th>
            <th className="px-3 py-2 font-semibold">Merek / Tipe</th>
            <th className="px-3 py-2 font-semibold">Tahun</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Gudang</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const statusMeta = ASSET_STATUS_META[a.status];
            return (
              <tr key={a.id} className="border-b border-borderSoft/60 last:border-b-0 hover:bg-neutralBg/60">
                <td className="px-3 py-2">
                  <p className="font-semibold text-text">{a.nama}</p>
                  <p className="font-mono text-[10px] text-textMuted">{a.labelRsd || '-'}</p>
                </td>
                <td className="px-3 py-2 font-mono text-textMuted">{a.nopol || '-'}</td>
                <td className="px-3 py-2 text-textMuted">{a.jenisTransportasi || '-'}</td>
                <td className="px-3 py-2 text-textMuted">{[a.merek, a.tipe].filter(Boolean).join(' ') || '-'}</td>
                <td className="px-3 py-2 text-textMuted">{a.tahunKendaraan ?? '-'}</td>
                <td className="px-3 py-2">
                  <Badge label={statusMeta.label} variant={statusMeta.variant} />
                </td>
                <td className="px-3 py-2 text-textMuted">{a.gudangNama}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function HierarchyPanel({
  points,
  selectedId,
  onSelect,
}: Readonly<{
  points: AssetMapPoint[];
  selectedId: number | null;
  onSelect: (p: AssetMapPoint) => void;
}>): React.JSX.Element {
  const tree = useMemo(() => buildHierarchyTree(points), [points]);

  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-textMuted">Hierarki</h3>
      {tree.length === 0 ? (
        <p className="text-[11px] text-textMuted">Belum ada aset berkoordinat.</p>
      ) : (
        <div className="flex flex-col">
          {tree.map((node) => (
            <TreeNodeRow key={node.key} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </Card>
  );
}

function PortManagementPanel({
  asset,
  allPoints,
  onPortsChanged,
}: Readonly<{
  asset: AssetMapPoint;
  allPoints: AssetMapPoint[];
  onPortsChanged: () => void;
}>): React.JSX.Element {
  const [ports, setPorts] = useState<AssetPortItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPort, setEditingPort] = useState<number | null>(null);
  const [mode, setMode] = useState<'pelanggan' | 'aset'>('pelanggan');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [childAssetId, setChildAssetId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  async function loadPorts(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await assetPortApi.list(String(asset.id));
      setPorts(res);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat data port.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {

    loadPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  function openPortEditor(port: AssetPortItem): void {
    setEditingPort(port.portNumber);
    setMode(port.childAssetId ? 'aset' : 'pelanggan');
    setCustomerName(port.customerName ?? '');
    setCustomerPhone(port.customerPhone ?? '');
    setChildAssetId(port.childAssetId ? String(port.childAssetId) : '');
  }

  async function handleSavePort(): Promise<void> {
    if (editingPort === null) return;
    setIsSaving(true);
    try {
      const res = await assetPortApi.set(String(asset.id), editingPort, {
        childAssetId: mode === 'aset' && childAssetId ? Number(childAssetId) : null,
        customerName: mode === 'pelanggan' ? customerName.trim() : '',
        customerPhone: mode === 'pelanggan' ? customerPhone.trim() : '',
      });
      setPorts(res);
      setEditingPort(null);
      toast.success(`Port ${editingPort} berhasil disimpan.`);
      onPortsChanged();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan port.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearPort(portNumber: number): Promise<void> {
    setIsSaving(true);
    try {
      await assetPortApi.clear(String(asset.id), portNumber);
      toast.success(`Port ${portNumber} berhasil dikosongkan.`);
      setEditingPort(null);
      await loadPorts();
      onPortsChanged();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal mengosongkan port.'));
    } finally {
      setIsSaving(false);
    }
  }

  const currentPort = ports?.find((p) => p.portNumber === editingPort) ?? null;

  return (
    <div className="flex flex-col gap-3 border-t border-borderSoft pt-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-textMuted">
        Port {asset.labelRsd}
      </h4>
      {isLoading ? (
        <p className="text-xs text-textMuted">Memuat port...</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {(ports ?? []).map((port) => {
            let portStateClass = 'border-borderSoft bg-surface text-textMuted hover:border-accent';
            if (editingPort === port.portNumber) {
              portStateClass = 'border-accent bg-accent text-white';
            } else if (port.status === 'terisi') {
              portStateClass = 'border-successText/40 bg-successBg text-successText hover:border-accent';
            }

            return (
              <button
                key={port.portNumber}
                type="button"
                onClick={() => openPortEditor(port)}
                title={port.customerName || port.childAssetLabel || `Port ${port.portNumber} — kosong`}
                className={`flex flex-col items-center justify-center rounded-md border px-1 py-2 text-[10px] font-semibold transition-colors ${portStateClass}`}
              >
                <span>{port.portNumber}</span>
                <span className="truncate w-full text-center text-[9px]">
                  {port.customerName || port.childAssetLabel || '-'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {editingPort !== null ? (
        <div className="flex flex-col gap-2 rounded-md border border-borderSoft p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text">Port {editingPort}</p>
            <button type="button" onClick={() => setEditingPort(null)} className="text-textMuted hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('pelanggan')}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                mode === 'pelanggan' ? 'bg-accent text-white' : 'border border-borderSoft text-textMuted'
              }`}
            >
              Ke Pelanggan
            </button>
            <button
              type="button"
              onClick={() => setMode('aset')}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                mode === 'aset' ? 'bg-accent text-white' : 'border border-borderSoft text-textMuted'
              }`}
            >
              Ke Aset Lain
            </button>
          </div>
          {mode === 'pelanggan' ? (
            <>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pelanggan"
                className="rounded-md border border-borderSoft px-3 py-1.5 text-xs outline-none focus:border-accent"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nomor HP pelanggan (opsional)"
                className="rounded-md border border-borderSoft px-3 py-1.5 text-xs outline-none focus:border-accent"
              />
            </>
          ) : (
            <select
              value={childAssetId}
              onChange={(e) => setChildAssetId(e.target.value)}
              className="rounded-md border border-borderSoft px-3 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="">Pilih aset...</option>
              {allPoints
                .filter((p) => p.id !== asset.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jenisAset.toUpperCase()} — {p.labelRsd}
                  </option>
                ))}
            </select>
          )}
          <div className="flex justify-end gap-2 pt-1">
            {currentPort?.status === 'terisi' ? (
              <button
                type="button"
                onClick={() => handleClearPort(editingPort)}
                disabled={isSaving}
                className="rounded-md border border-borderSoft px-3 py-1.5 text-[11px] font-semibold text-dangerText hover:border-dangerText disabled:opacity-50"
              >
                Kosongkan
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSavePort}
              disabled={isSaving}
              className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const EVENT_TYPE_LABEL: Record<AssetHistoryEntry['eventType'], string> = {
  dibuat: 'Dibuat',
  status: 'Status diubah',
  lokasi: 'Lokasi diubah',
  induk: 'Aset induk diubah',

  gudang: 'Dipindahkan ke gudang lain',
  port: 'Port diubah',
  nilai_aset: 'Nilai aset diubah',
  data_transportasi: 'Data transportasi diubah',
};

type HistoryTrackingMode = 'harian' | 'bulanan';

function currentBulan(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftBulan(bulan: string, delta: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface AssetHistoryToolbarProps {
  mode: HistoryTrackingMode;
  onModeChange: (mode: HistoryTrackingMode) => void;
  bulan: string;
  onShiftBulan: (delta: number) => void;
}

function AssetHistoryToolbar({ mode, onModeChange, bulan, onShiftBulan }: Readonly<AssetHistoryToolbarProps>): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex w-fit rounded-full border border-borderSoft bg-surfaceAlt p-0.5">
        {(['harian', 'bulanan'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onModeChange(opt)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${
              mode === opt ? 'bg-accentDark text-white' : 'text-textMuted hover:text-text'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {mode === 'bulanan' ? (
        <div className="flex items-center gap-1.5 text-[11px] text-textMuted">
          <button
            type="button"
            onClick={() => onShiftBulan(-1)}
            className="rounded p-0.5 hover:bg-neutralBg hover:text-accentDark"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center font-semibold text-text">{formatBulanTahun(`${bulan}-01`)}</span>
          <button
            type="button"
            onClick={() => onShiftBulan(1)}
            className="rounded p-0.5 hover:bg-neutralBg hover:text-accentDark"
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AssetHistoryPanel({ assetId }: Readonly<{ assetId: number }>): React.JSX.Element {
  const [mode, setMode] = useState<HistoryTrackingMode>('harian');
  const [bulan, setBulan] = useState(currentBulan);
  const [entries, setEntries] = useState<AssetHistoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const request =
      mode === 'bulanan' ? assetHistoryApi.listByBulan(String(assetId), bulan) : assetHistoryApi.list(String(assetId));
    request
      .then((res) => {
        if (!cancelled) setEntries(res);
      })
      .catch(() => {
        if (!cancelled) toast.error('Gagal memuat riwayat aset.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, mode, bulan]);

  let historyContent: React.JSX.Element;
  if (isLoading) {
    historyContent = <p className="text-xs text-textMuted">Memuat riwayat...</p>;
  } else if (!entries || entries.length === 0) {
    const bulanLabel = formatBulanTahun(`${bulan}-01`);
    historyContent = (
      <p className="text-xs text-textMuted">
        {mode === 'bulanan'
          ? `Tidak ada riwayat perubahan tercatat pada ${bulanLabel}.`
          : 'Belum ada riwayat perubahan tercatat untuk aset ini.'}
      </p>
    );
  } else {
    historyContent = (
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 border-l-2 border-accent/40 pl-3 text-xs">
            <div className="flex-1">
              <p className="font-semibold text-text">{EVENT_TYPE_LABEL[entry.eventType] ?? entry.eventType}</p>
              {entry.fieldLama || entry.fieldBaru ? (
                <p className="text-textMuted">
                  {entry.fieldLama || '-'} <span className="mx-1">→</span> {entry.fieldBaru || '-'}
                </p>
              ) : null}
              {entry.catatan ? <p className="text-textMuted">{entry.catatan}</p> : null}
              <p className="mt-0.5 text-[10px] text-textMuted">
                {new Date(entry.createdAt).toLocaleString('id-ID')} {entry.userNama ? `· ${entry.userNama}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-borderSoft pt-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-textMuted">Riwayat Perubahan</h4>
      <AssetHistoryToolbar
        mode={mode}
        onModeChange={setMode}
        bulan={bulan}
        onShiftBulan={(delta) => setBulan((prev) => shiftBulan(prev, delta))}
      />
      {historyContent}
    </div>
  );
}
