'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { RefreshCw, X, Pencil, Trash2, Network, History } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Badge } from '@/component/ui/Badge';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { ASSET_STATUS_META, PING_STATUS_META } from '@/lib/utils/status';
import { assetsApi, assetPortApi, assetHistoryApi, type AssetMapPoint, type AssetPortItem, type AssetHistoryEntry } from '@/lib/api/modules';
import { friendlyError } from '@/lib/utils/errors';
import type { JenisAset, AssetStatus } from '@/types';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });

/**
 * Peta Leaflet/OpenStreetMap (open source, gratis) menampilkan seluruh
 * titik aset berkoordinat. UX terinspirasi referensi Fibero (panel layer
 * kiri, legenda status, panel detail saat klik titik, garis penghubung
 * antar node) — TAPI disesuaikan ke skema data aplikasi ini (bukan sistem
 * pelanggan/port ISP seperti referensi; garis penghubungnya dari tiap
 * aset ke GUDANG pemiliknya, karena skema saat ini belum punya relasi
 * hierarki aset-ke-aset/pelanggan-ke-port).
 *
 * PENTING: tampilan MARKER (warna & singkatan per jenis aset di
 * JENIS_MARKER_META) SENGAJA TIDAK diubah sesuai permintaan eksplisit —
 * semua penambahan di bawah ini (panel layer, filter status, panel
 * detail, garis kabel) murni logika DI SEKITAR marker yang sudah ada.
 */
const JENIS_MARKER_META: Record<string, { abbr: string; color: string; label: string }> = {
  tiang: { abbr: 'TG', color: '#78350f', label: 'Tiang' },
  odc: { abbr: 'ODC', color: '#b5451b', label: 'ODC' },
  ont: { abbr: 'ONT', color: '#2563eb', label: 'ONT' },
  odp: { abbr: 'ODP', color: '#059669', label: 'ODP' },
  olt: { abbr: 'OLT', color: '#7c3aed', label: 'OLT' },
  modem: { abbr: 'MDM', color: '#d97706', label: 'Modem' },
  transportasi: { abbr: 'TR', color: '#6b7280', label: 'Transportasi' },
};

const JENIS_URUTAN: JenisAset[] = ['tiang', 'odc', 'ont', 'odp', 'olt'];
const STATUS_URUTAN: AssetStatus[] = ['aktif', 'rusak', 'nonaktif'];

/**
 * Label marker: "[nama gudang](kantor pusat/cabang) - RSD - [no urut]"
 * mis. "mahang(kantor pusat) - RSD - 001". Diturunkan dari `labelRsd` yang
 * sudah dibuat backend dengan format "{KODE_GUDANG}-RSD-{no urut}".
 */
function formatMarkerLabel(point: AssetMapPoint): string {
  const match = point.labelRsd.match(/-RSD-(\d+)$/i);
  const noUrut = match ? match[1] : point.labelRsd;
  const tipeLabel = point.gudangTipe === 'pusat' ? 'kantor pusat' : 'kantor cabang';
  return `${point.gudangNama.toLowerCase()}(${tipeLabel}) - RSD - ${noUrut}`;
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
  const [selectedPoint, setSelectedPoint] = useState<AssetMapPoint | null>(null);
  const [showPortPanel, setShowPortPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [pingingId, setPingingId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipe Leaflet.DivIcon, hanya tersedia lewat dynamic import di client
  const [leafletIcons, setLeafletIcons] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    import('leaflet').then((L) => {
      const icons: Record<string, L.DivIcon> = {};
      Object.keys(JENIS_MARKER_META).forEach((jenis) => {
        const meta = JENIS_MARKER_META[jenis];
        icons[jenis] = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${meta.color};color:#fff;font-size:9px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);">${meta.abbr}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17],
        });
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- inisialisasi ikon sekali setelah leaflet ter-import di client
      setLeafletIcons(icons);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPoints async
    loadPoints();
  }, []);

  const points = useMemo(
    () =>
      allPoints.filter(
        (p) => visibleJenis.has(p.jenisAset) && (!statusFilter || p.status === statusFilter),
      ),
    [allPoints, visibleJenis, statusFilter],
  );

  // Hitung per-jenis & per-status untuk panel layer/legenda — dari
  // SELURUH titik (allPoints), bukan yang sudah difilter, supaya angkanya
  // tidak "menghilang" saat sebuah layer disembunyikan.
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

  async function handlePing(point: AssetMapPoint): Promise<void> {
    if (!point.ipAddress) {
      toast.error('Aset ini belum punya alamat IP — isi dulu lewat form Ubah Aset.');
      return;
    }
    setPingingId(point.id);
    try {
      const res = await assetsApi.ping(String(point.id));
      toast[res.pingStatus === 'online' ? 'success' : 'error'](
        `${point.labelRsd}: ${res.pingStatus === 'online' ? `Online (${res.rttMs ?? 0}ms)` : 'Offline / tidak merespon'}`,
      );
      await loadPoints();
      setSelectedPoint((prev) => (prev && prev.id === point.id ? { ...prev, pingStatus: res.pingStatus } : prev));
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal melakukan ping.'));
    } finally {
      setPingingId(null);
    }
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
  const center: [number, number] = firstPoint ? [firstPoint.latitude, firstPoint.longitude] : [-6.9147, 107.6098]; // fallback: Bandung

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col gap-4">
          {/* Panel Layer & Status — terinspirasi panel kiri referensi Fibero. */}
          <Card className="flex flex-col gap-4">
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

        {/* Panel Hierarki — meniru struktur pohon POP▸OLT▸ODC▸ODP di
            referensi Fibero, dibangun dari relasi parentAssetId (bukan
            hardcode) + dikelompokkan per gudang untuk aset yang belum
            disambungkan ke induk manapun. */}
        <HierarchyPanel points={allPoints} selectedId={selectedPoint?.id ?? null} onSelect={(p) => { setSelectedPoint(p); setShowPortPanel(false); }} />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="relative z-0 overflow-hidden p-0">
            {leafletIcons ? (
              <MapContainer center={center} zoom={points.length ? 12 : 6} style={{ height: '560px', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {showCable &&
                  points
                    .map((p) => {
                      // Prioritaskan garis ke ASET INDUK (hierarki jaringan
                      // sungguhan, mis. ODP -> ODC) kalau ada koordinatnya;
                      // fallback ke garis ke gudang kalau aset ini belum
                      // disambungkan ke induk manapun.
                      const target =
                        p.parentLatitude != null && p.parentLongitude != null
                          ? ([p.parentLatitude, p.parentLongitude] as [number, number])
                          : p.gudangLatitude != null && p.gudangLongitude != null
                            ? ([p.gudangLatitude, p.gudangLongitude] as [number, number])
                            : null;
                      const isHierarki = p.parentLatitude != null && p.parentLongitude != null;
                      if (!target) return null;
                      return (
                        <Polyline
                          key={`kabel-${p.id}`}
                          positions={[[p.latitude, p.longitude], target]}
                          pathOptions={
                            isHierarki
                              ? { color: '#b3471f', weight: 2, opacity: 0.8 }
                              : { color: '#94a3b8', weight: 1.5, dashArray: '4 5', opacity: 0.7 }
                          }
                        />
                      );
                    })}
                {points.map((point) => (
                  <Marker
                    key={point.id}
                    position={[point.latitude, point.longitude]}
                    icon={leafletIcons[point.jenisAset] ?? leafletIcons.tiang}
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
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="flex h-[560px] w-full items-center justify-center bg-surfaceAlt text-sm text-textMuted">
                Memuat peta...
              </div>
            )}
          </Card>

          {isLoading ? <p className="text-xs text-textMuted">Memuat titik aset...</p> : null}
        </div>
      </div>

      {/* Panel Detail — muncul saat marker diklik, terinspirasi panel
          kanan referensi Fibero (nama, alamat, status, aksi cepat). */}
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
            {selectedPoint.ipAddress ? (
              <Badge
                label={PING_STATUS_META[selectedPoint.pingStatus ?? 'unknown'].label}
                variant={PING_STATUS_META[selectedPoint.pingStatus ?? 'unknown'].variant}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-1 text-xs text-textMuted sm:grid-cols-2">
            <p>Gudang: {selectedPoint.gudangNama} ({selectedPoint.gudangKode})</p>
            <p>Koordinat: {selectedPoint.latitude}, {selectedPoint.longitude}</p>
            {selectedPoint.ipAddress ? <p>Alamat IP: {selectedPoint.ipAddress}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-borderSoft pt-3">
            {selectedPoint.ipAddress ? (
              <button
                type="button"
                onClick={() => handlePing(selectedPoint)}
                disabled={pingingId === selectedPoint.id}
                className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-1.5 text-xs font-semibold text-text hover:border-accent disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pingingId === selectedPoint.id ? 'animate-spin' : ''}`} /> Cek Ping
              </button>
            ) : null}
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
              href="/home/aset-gudang"
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

          {/* Panel Kelola Port — meniru grid "Port 1..8" di panel detail
              referensi Fibero: klik satu port untuk sambungkan ke
              pelanggan ATAU ke aset lain (hierarki jaringan). */}
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
  point: AssetMapPoint | null; // null = node semu "Gudang" (pengelompokan, bukan aset sungguhan)
  key: string;
  label: string;
  children: TreeNode[];
}

/** Bangun pohon dari relasi parentAssetId (flat list -> nested tree).
 * Aset tanpa induk dikelompokkan di bawah node semu per Gudang (supaya
 * tetap ada struktur meski belum ada satu pun relasi induk-anak diisi —
 * mis. saat fitur ini baru mulai dipakai). */
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
    label: `${g.nama} (${g.kode})`,
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
}: {
  node: TreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (p: AssetMapPoint) => void;
}): React.JSX.Element {
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

function HierarchyPanel({
  points,
  selectedId,
  onSelect,
}: {
  points: AssetMapPoint[];
  selectedId: number | null;
  onSelect: (p: AssetMapPoint) => void;
}): React.JSX.Element {
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

/**
 * Grid port meniru panel detail referensi Fibero: kotak kecil per nomor
 * port, warna beda untuk kosong vs terisi. Klik satu port -> form kecil
 * di bawah grid untuk isi pelanggan ATAU sambungkan ke aset lain
 * (hierarki jaringan), atau kosongkan lagi.
 */
function PortManagementPanel({
  asset,
  allPoints,
  onPortsChanged,
}: {
  asset: AssetMapPoint;
  allPoints: AssetMapPoint[];
  onPortsChanged: () => void;
}): React.JSX.Element {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPorts async
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
          {(ports ?? []).map((port) => (
            <button
              key={port.portNumber}
              type="button"
              onClick={() => openPortEditor(port)}
              title={port.customerName || port.childAssetLabel || `Port ${port.portNumber} — kosong`}
              className={`flex flex-col items-center justify-center rounded-md border px-1 py-2 text-[10px] font-semibold transition-colors ${
                editingPort === port.portNumber
                  ? 'border-accent bg-accent text-white'
                  : port.status === 'terisi'
                    ? 'border-successText/40 bg-successBg text-successText hover:border-accent'
                    : 'border-borderSoft bg-surface text-textMuted hover:border-accent'
              }`}
            >
              <span>{port.portNumber}</span>
              <span className="truncate w-full text-center text-[9px]">
                {port.customerName || port.childAssetLabel || '-'}
              </span>
            </button>
          ))}
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
  ping: 'Konektivitas berubah',
  port: 'Port diubah',
};

/** Timeline riwayat perubahan aset — inti fitur "tracking" yang
 * sebenarnya: bukan cuma kondisi terkini, tapi apa yang berubah, kapan,
 * dan siapa yang mengubah (lihat model.AssetHistory backend). */
function AssetHistoryPanel({ assetId }: { assetId: number }): React.JSX.Element {
  const [entries, setEntries] = useState<AssetHistoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    assetHistoryApi
      .list(String(assetId))
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
  }, [assetId]);

  return (
    <div className="flex flex-col gap-2 border-t border-borderSoft pt-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-textMuted">Riwayat Perubahan</h4>
      {isLoading ? (
        <p className="text-xs text-textMuted">Memuat riwayat...</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-xs text-textMuted">Belum ada riwayat perubahan tercatat untuk aset ini.</p>
      ) : (
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
      )}
    </div>
  );
}
