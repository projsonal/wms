'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, Printer, MapPin } from 'lucide-react';
import { deliveriesApi } from '@/lib/api/modules';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { Delivery, DeliveryItem } from '@/types';

const COMPANY = {
  name: 'PT. Reueus Sumber Data',
  address: 'Jl. Asia Afrika 141-149 Lt.3 Cluster 7 M. Adimidjojo, Bandung',
  email: 'admin@reueus.net',
  phone: '0811 2111 0923',
};

const KNOWN_COURIER_BRANDS = ['JNE', 'J&T', 'SICEPAT', 'ANTERAJA', 'LALAMOVE', 'GOSEND', 'NINJA XPRESS'];

function matchCourierBrand(courierName: string): string | null {
  const upper = courierName.toUpperCase();
  return KNOWN_COURIER_BRANDS.find((brand) => upper.includes(brand)) ?? null;
}

function formatResiSku(sku: string): string {
  return sku.toUpperCase().startsWith('WRSD-') ? sku.toUpperCase() : `WRSD-${sku}`;
}

const INDONESIAN_PROVINCES = new Set([
  'ACEH', 'SUMATERA UTARA', 'SUMATERA BARAT', 'RIAU', 'KEPULAUAN RIAU', 'JAMBI', 'BENGKULU',
  'SUMATERA SELATAN', 'KEPULAUAN BANGKA BELITUNG', 'LAMPUNG', 'DKI JAKARTA', 'JAWA BARAT',
  'JAWA TENGAH', 'DI YOGYAKARTA', 'DAERAH ISTIMEWA YOGYAKARTA', 'JAWA TIMUR', 'BANTEN', 'BALI',
  'NUSA TENGGARA BARAT', 'NUSA TENGGARA TIMUR', 'KALIMANTAN BARAT', 'KALIMANTAN TENGAH',
  'KALIMANTAN SELATAN', 'KALIMANTAN TIMUR', 'KALIMANTAN UTARA', 'SULAWESI UTARA', 'GORONTALO',
  'SULAWESI TENGAH', 'SULAWESI BARAT', 'SULAWESI SELATAN', 'SULAWESI TENGGARA', 'MALUKU',
  'MALUKU UTARA', 'PAPUA', 'PAPUA BARAT', 'PAPUA TENGAH', 'PAPUA PEGUNUNGAN', 'PAPUA SELATAN',
  'PAPUA BARAT DAYA',
]);

function extractAreaLabels(address: string): { broad: string; narrow: string } | null {
  const segments = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1]?.toUpperCase() ?? '';
  const withoutProvince = INDONESIAN_PROVINCES.has(last) ? segments.slice(0, -1) : segments;
  if (withoutProvince.length < 2) return null;

  return {
    broad: withoutProvince[withoutProvince.length - 1].toUpperCase(),
    narrow: withoutProvince[withoutProvince.length - 2].toUpperCase(),
  };
}

function totalWeightGram(items: DeliveryItem[] | undefined): number {
  return (items ?? []).reduce((sum, it) => sum + (it.weightGram ?? 0) * it.qty, 0);
}

function RealBarcode({ value }: { value: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (!canvasRef.current) return;
      JsBarcode(canvasRef.current, value, {
        format: 'CODE128',
        width: 3,
        height: 90,
        displayValue: false,
        margin: 0,
      });
    });
  }, [value]);

  return <canvas ref={canvasRef} className="max-w-full" />;
}

interface AreaBoxesProps {
  areaLabels: { broad: string; narrow: string } | null;
  deliveryType: 'pickup' | 'dropoff';
  statusLabel: string;
}

function AreaBoxes({ areaLabels, deliveryType, statusLabel }: AreaBoxesProps): React.JSX.Element {
  if (!areaLabels) {
    return (
      <div className="border-b border-borderSoft py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-text py-2 text-center">
            <p className="text-sm font-bold uppercase text-text">
              {deliveryType === 'pickup' ? 'Pickup' : 'Dropoff'}
            </p>
          </div>
          <div className="rounded-md border border-text py-2 text-center">
            <p className="text-sm font-bold uppercase text-text">{statusLabel}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-borderSoft py-4">
      <p className="mb-1.5 text-center text-[9px] uppercase tracking-wide text-textMuted">Wilayah Tujuan</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-text py-2 text-center">
          <p className="text-sm font-bold uppercase text-text">{areaLabels.broad}</p>
        </div>
        <div className="rounded-md border border-text py-2 text-center">
          <p className="text-sm font-bold uppercase text-text">{areaLabels.narrow}</p>
        </div>
      </div>
    </div>
  );
}

function SenderReceiverBlock({ delivery }: { delivery: Delivery }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-6 border-b border-borderSoft py-5 sm:grid-cols-2">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-textMuted">Pengirim</p>
        <p className="text-sm font-bold text-text">{delivery.origin}</p>
        {delivery.originAddress ? <p className="text-xs text-textMuted">{delivery.originAddress}</p> : null}
        {delivery.originPhone ? <p className="text-xs text-textMuted">Telp: {delivery.originPhone}</p> : null}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-textMuted">Penerima</p>
        <p className="text-sm font-bold text-text">{delivery.receiverName ?? delivery.destination}</p>
        <p className="text-xs text-textMuted">{delivery.destination}</p>
        {delivery.receiverPhone ? <p className="text-xs text-textMuted">Telp: {delivery.receiverPhone}</p> : null}
      </div>
    </div>
  );
}

function ItemsTable({ items }: { items: DeliveryItem[] }): React.JSX.Element {
  return (
    <div className="border-b border-borderSoft py-4">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-textMuted">Daftar Barang</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-borderSoft text-left text-textMuted">
            <th className="pb-1 font-medium">SKU</th>
            <th className="pb-1 font-medium">Nama Barang</th>
            <th className="pb-1 text-right font-medium">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sku} className="border-b border-dashed border-borderSoft last:border-0">
              <td className="py-1.5 font-mono text-text">{formatResiSku(item.sku)}</td>
              <td className="py-1.5 text-text">{item.name}</td>
              <td className="py-1.5 text-right text-text">
                {item.qty} {item.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useDeliveryData() {
  const params = useParams<{ id: string }>();
  const { data: delivery, isLoading } = useSWR(
    params.id ? ['receipt', params.id] : null,
    () => deliveriesApi.getById(params.id),
  );
  return { delivery, isLoading };
}

export function ReceiptContent(): React.JSX.Element {
  const { delivery, isLoading } = useDeliveryData();

  if (isLoading || !delivery) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-textMuted">
        Memuat resi...
      </div>
    );
  }

  const printedAt = new Date();
  const statusMeta = DELIVERY_STATUS_META[delivery.status];
  const courierBrand = delivery.courierName && delivery.courierName !== '-' ? matchCourierBrand(delivery.courierName) : null;
  const weight = totalWeightGram(delivery.items);
  const hasCoord = typeof delivery.latitude === 'number' && typeof delivery.longitude === 'number';
  const areaLabels = extractAreaLabels(delivery.destination);

  return (
    <div className="min-h-screen bg-neutralBg pb-12">

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-borderSoft bg-surface px-6 py-3 print:hidden">
        <Link href={`/delivery/${delivery.id}`} className="flex items-center gap-1.5 text-sm text-textMuted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <p className="text-sm font-medium text-textMuted">Resi Pengiriman · {delivery.code}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-accentDark px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          <Printer className="h-4 w-4" /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="mx-auto mt-6 w-full max-w-2xl rounded-lg border-2 border-text bg-surface p-6 shadow-card print:m-0 print:max-w-none print:border print:shadow-none">

        <div className="flex items-center justify-between border-b-2 border-dashed border-text pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-7 w-7 text-accentDark" />
            <div>
              <p className="text-base font-bold leading-tight text-text">{COMPANY.name}</p>
              <p className="text-[10px] text-textMuted">WMS-RSD Logistics</p>
            </div>
          </div>
          <div className="rounded-md border border-text px-3 py-1 text-right">
            <p className="text-[9px] uppercase tracking-wide text-textMuted">
              {courierBrand ? 'Mitra Kurir' : 'Pengiriman'}
            </p>
            <p className="text-sm font-bold text-text">{courierBrand ?? 'Internal'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-borderSoft py-3">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-textMuted">Order ID</p>
            <p className="text-sm font-bold text-text">{delivery.orderId ?? '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-borderSoft px-2 py-0.5 text-[10px] font-semibold uppercase text-textMuted">
              {delivery.type === 'pickup' ? 'Pickup' : 'Dropoff'}
            </span>
            <span className="rounded-full border border-borderSoft px-2 py-0.5 text-[10px] font-semibold uppercase text-textMuted">
              {statusMeta.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-textMuted">Tanggal</p>
            <p className="text-sm font-bold text-text">{formatDate(delivery.scheduledAt)}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 border-b-2 border-dashed border-text py-6">
          <RealBarcode value={delivery.code} />
          <p className="mt-1 font-mono text-lg font-bold tracking-widest text-text">{delivery.code}</p>
          <p className="text-[10px] uppercase tracking-wide text-textMuted">No. Resi</p>
        </div>

        <SenderReceiverBlock delivery={delivery} />

        <AreaBoxes areaLabels={areaLabels} deliveryType={delivery.type} statusLabel={statusMeta.label} />

        <div className="grid grid-cols-2 gap-4 border-b border-borderSoft py-5 sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-textMuted">Kurir</p>
            <p className="text-sm font-semibold text-text">{delivery.courierName}</p>
            {delivery.courierPhone ? <p className="text-xs text-textMuted">{delivery.courierPhone}</p> : null}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-textMuted">Berat</p>
            <p className="text-sm font-semibold text-text">
              {weight > 0 ? `${formatNumber(weight)} gr` : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-textMuted">Jarak Tempuh</p>
            <p className="text-sm font-semibold text-text">{delivery.distanceKm} km</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-textMuted">Terkirim</p>
            <p className="text-sm font-semibold text-text">
              {delivery.deliveredAt ? formatDate(delivery.deliveredAt) : '-'}
            </p>
          </div>
        </div>

        {delivery.items && delivery.items.length > 0 ? <ItemsTable items={delivery.items} /> : null}

        {hasCoord ? (
          <div className="flex items-center gap-2 border-b border-borderSoft py-4 text-xs text-textMuted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              Titik Koordinat ({delivery.origin}): {delivery.latitude?.toFixed(6)}, {delivery.longitude?.toFixed(6)}
            </span>
          </div>
        ) : null}

        {delivery.notes ? (
          <div className="border-b border-borderSoft py-5">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-textMuted">Catatan</p>
            <p className="rounded-md border border-dashed border-borderSoft p-3 text-sm text-text">
              {delivery.notes}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs text-textMuted">
          <div>
            <div className="mb-10 border-b border-text" />
            Pengirim
            <br />
            Tanda tangan &amp; nama jelas
          </div>
          <div>
            <div className="mb-10 border-b border-text" />
            Kurir
            <br />
            Tanda tangan &amp; nama jelas
          </div>
          <div>
            <div className="mb-10 border-b border-text" />
            Penerima
            <br />
            Tanda tangan &amp; nama jelas
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 border-t border-borderSoft pt-3 text-[10px] text-textMuted sm:flex-row sm:justify-between">
          <span>
            {COMPANY.address} · {COMPANY.email} · {COMPANY.phone}
          </span>
          <span>Dicetak {printedAt.toLocaleDateString('id-ID')}, {printedAt.toLocaleTimeString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
}
