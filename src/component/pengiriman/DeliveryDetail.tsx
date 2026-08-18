'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Phone, Printer, CheckCircle2 } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { RouteTrackingMap } from '@/component/pengiriman/RouteTrackingMap';
import { ShareLocationButton } from '@/component/pengiriman/ShareLocationButton';
import { useAuth } from '@/auth/AuthContext';
import { deliveriesApi } from '@/lib/api/modules';
import { friendlyError } from '@/lib/utils/errors';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { Delivery } from '@/types';

/** Pusat peta default kalau belum ada koordinat sama sekali — kantor pusat
 * StokRSD (Bandung), sekadar titik awal yang masuk akal. */
const FALLBACK_CENTER = { lat: -6.9147, lng: 107.6098 };

function totalWeightGram(items: Delivery['items']): number {
  return (items ?? []).reduce((sum, it) => sum + (it.weightGram ?? 0) * it.qty, 0);
}

/** Sidebar "Daftar Pengiriman" — daftar semua pengiriman dengan pencarian,
 * dipakai memilih pengiriman lain tanpa harus kembali ke Monitoring
 * Pengiriman. Mengikuti pola sidebar pada referensi desain. */
function DeliveryListSidebar({ activeId }: { activeId: string }): React.JSX.Element {
  const [search, setSearch] = useState('');
  const { data: result, isLoading } = useSWR('delivery-detail-sidebar', () => deliveriesApi.list({ pageSize: 50 }));

  const rows = (result?.data ?? []).filter((d) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return d.code.toLowerCase().includes(term) || d.destination.toLowerCase().includes(term);
  });

  return (
    <Card className="flex h-fit flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-text">Daftar Pengiriman</h2>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-textMuted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari resi / tujuan..."
          className="w-full rounded-full border border-borderSoft bg-surfaceAlt py-2 pl-9 pr-3 text-xs outline-none focus:border-accent"
        />
      </div>
      {isLoading ? (
        <p className="text-xs text-textMuted">Memuat...</p>
      ) : (
        <ul className="flex max-h-[520px] flex-col gap-2 overflow-auto pr-1">
          {rows.map((row) => {
            const meta = DELIVERY_STATUS_META[row.status];
            const isActive = row.id === activeId;
            return (
              <li key={row.id}>
                <Link
                  href={`/home/delivery/${row.id}`}
                  className={`block rounded-md border p-3 text-xs transition-colors ${
                    isActive ? 'border-accentDark bg-accentSoft' : 'border-borderSoft hover:border-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">{row.code}</span>
                    <Badge label={meta.label} variant={meta.variant} />
                  </div>
                  <p className="mt-1 truncate text-textMuted">{row.destination}</p>
                </Link>
              </li>
            );
          })}
          {rows.length === 0 ? <p className="text-xs text-textMuted">Tidak ada hasil.</p> : null}
        </ul>
      )}
    </Card>
  );
}

function StatCards({ delivery, liveDistanceKm }: { delivery: Delivery; liveDistanceKm: number | null }): React.JSX.Element {
  const weight = totalWeightGram(delivery.items);
  // Prioritaskan jarak hasil hitung rute jalan sungguhan (OSRM, lihat
  // onRouteComputed di RouteTrackingMap) kalau sudah ada — itu angka yang
  // benar-benar mengikuti jalan raya. delivery.distanceKm dari backend
  // cuma dipakai sebagai fallback SEBELUM rute selesai dihitung (biasanya
  // 0/belum terisi, itu sebabnya sebelumnya kartu ini selalu kelihatan
  // "0 km" walau peta rute sudah tergambar — dua angka itu sebelumnya
  // tidak pernah disambungkan satu sama lain).
  const distanceLabel = liveDistanceKm !== null ? liveDistanceKm.toFixed(1) : delivery.distanceKm;
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="p-4 text-center">
        <p className="text-xl font-bold text-text">{distanceLabel} km</p>
        <p className="text-[10px] uppercase tracking-wide text-textMuted">Jarak Tempuh</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-xl font-bold text-text">{weight > 0 ? `${formatNumber(weight)} gr` : '-'}</p>
        <p className="text-[10px] uppercase tracking-wide text-textMuted">Berat Barang</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-xl font-bold text-text">{delivery.items?.length ?? 0}</p>
        <p className="text-[10px] uppercase tracking-wide text-textMuted">Jenis Barang</p>
      </Card>
    </div>
  );
}

function CourierCard({ delivery }: { delivery: Delivery }): React.JSX.Element {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accentSoft text-sm font-bold text-accentDark">
          {delivery.courierName?.slice(0, 2).toUpperCase() ?? '-'}
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{delivery.courierName || 'Belum ditugaskan'}</p>
          <p className="text-xs text-textMuted">{delivery.courierPhone || '-'}</p>
        </div>
      </div>
      {delivery.courierPhone ? (
        <a
          href={`tel:${delivery.courierPhone}`}
          className="flex items-center gap-1.5 rounded-md border border-borderSoft px-3 py-2 text-xs font-semibold text-text hover:border-accent"
        >
          <Phone className="h-3.5 w-3.5" /> Hubungi Kurir
        </a>
      ) : null}
    </Card>
  );
}

interface ItemsAndActionsProps {
  delivery: Delivery;
  onComplete: () => Promise<void>;
  isCompleting: boolean;
}

function ItemsAndActions({ delivery, onComplete, isCompleting }: ItemsAndActionsProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-text">Detail Barang Dikirim</h2>
      {delivery.items && delivery.items.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-borderSoft text-left text-textMuted">
              <th className="pb-1 font-medium">SKU</th>
              <th className="pb-1 font-medium">Nama Barang</th>
              <th className="pb-1 text-right font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {delivery.items.map((item) => (
              <tr key={item.sku} className="border-b border-dashed border-borderSoft last:border-0">
                <td className="py-1.5 font-mono text-text">{item.sku}</td>
                <td className="py-1.5 text-text">{item.name}</td>
                <td className="py-1.5 text-right text-text">
                  {item.qty} {item.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-textMuted">
          Pengiriman ini tidak tertaut ke dokumen Barang Keluar — tidak ada rincian item.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={`/home/receipt/${delivery.id}`}>
          <Button variant="secondary">
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak Resi
          </Button>
        </Link>
        {delivery.status === 'perjalanan' ? (
          <Button onClick={onComplete} loading={isCompleting}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Tandai Selesai
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function DeliveryDetailContent(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const isCourierRole = user?.role === 'karyawan';
  const [isCompleting, setIsCompleting] = useState(false);
  // Diisi lewat callback onRouteComputed dari RouteTrackingMap begitu rute
  // jalan sungguhan (OSRM) berhasil dihitung -- lihat catatan di StatCards.
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | null>(null);

  const { data: delivery, isLoading, error, mutate } = useSWR(
    params.id ? ['delivery-detail', params.id] : null,
    () => deliveriesApi.getById(params.id),
  );

  async function handleComplete(): Promise<void> {
    if (!delivery) return;
    const ok = await confirm({
      title: 'Tandai Selesai',
      message: `Tandai pengiriman ${delivery.code} sudah sampai tujuan?`,
      confirmLabel: 'Ya, Selesai',
      variant: 'default',
    });
    if (!ok) return;
    setIsCompleting(true);
    try {
      await deliveriesApi.complete(delivery.id);
      toast.success('Pengiriman ditandai selesai.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menandai pengiriman selesai.'));
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Detail Lacak Pengiriman" breadcrumb="Pengiriman / Memuat...">
        <p className="text-sm text-textMuted">Memuat data pengiriman...</p>
      </PageShell>
    );
  }

  if (error || !delivery) {
    return (
      <PageShell title="Detail Lacak Pengiriman" breadcrumb="Pengiriman / Tidak ditemukan">
        <p className="text-sm text-dangerText">Dokumen pengiriman tidak ditemukan.</p>
      </PageShell>
    );
  }

  const meta = DELIVERY_STATUS_META[delivery.status];

  return (
    <PageShell title="Detail Lacak Pengiriman" breadcrumb={`Menu Utama / Lacak Pengiriman / ${delivery.code}`}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <DeliveryListSidebar activeId={delivery.id} />

        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text">{delivery.code}</h2>
                <Badge label={meta.label} variant={meta.variant} />
              </div>
              <p className="text-xs text-textMuted">
                {delivery.origin} → {delivery.destination}
              </p>
              <p className="text-xs text-textMuted">Jadwal: {formatDate(delivery.scheduledAt)}</p>
            </div>
            <Button variant="secondary" onClick={() => router.push('/home/delivery-monitoring')}>
              Lihat Semua Pengiriman
            </Button>
          </Card>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-text">Peta Pelacakan Live</h2>
            <RouteTrackingMap
              deliveryId={delivery.id}
              courierName={delivery.courierName}
              originLabel={delivery.origin}
              originCoord={
                delivery.originLatitude === undefined || delivery.originLongitude === undefined
                  ? undefined
                  : { lat: delivery.originLatitude, lng: delivery.originLongitude }
              }
              destinationLabel={delivery.destination}
              destinationCoord={
                delivery.destLatitude === undefined || delivery.destLongitude === undefined
                  ? undefined
                  : { lat: delivery.destLatitude, lng: delivery.destLongitude }
              }
              fallbackCenter={FALLBACK_CENTER}
              isDelivered={delivery.status === 'terkirim'}
              onRouteComputed={(route) => setLiveDistanceKm(route.distanceKm)}
            />
            {isCourierRole ? (
              <div className="mt-2">
                <ShareLocationButton deliveryId={delivery.id} />
              </div>
            ) : null}
          </div>

          <StatCards delivery={delivery} liveDistanceKm={liveDistanceKm} />
          <CourierCard delivery={delivery} />
          <ItemsAndActions delivery={delivery} onComplete={handleComplete} isCompleting={isCompleting} />
        </div>
      </div>
    </PageShell>
  );
}
