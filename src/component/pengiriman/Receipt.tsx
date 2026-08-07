'use client';

import { useParams } from 'next/navigation';
import { PageShell } from '@/component/layout/PageShell';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { SEED_DELIVERIES } from '@/lib/data/sample-data';
import { formatDate } from '@/lib/utils/format';

export function ReceiptContent(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const delivery = SEED_DELIVERIES.find((item) => item.id === params.id) ?? SEED_DELIVERIES[0]!;

  return (
    <PageShell
      title="Cetak Resi"
      breadcrumb={`Pengiriman / Cetak Resi / ${delivery.code}`}
      action={
        <Button onClick={() => window.print()} className="print:hidden">
          Cetak
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-md">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-dashed border-borderSoft pb-3">
            <span className="text-lg font-bold text-accentDark">StokRSD WMS</span>
            <span className="text-xs text-textMuted">Bukti Pengiriman</span>
          </div>
          <div className="flex justify-center">
            <div
              aria-hidden
              className="h-16 w-full max-w-xs"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #2b211d 0 2px, transparent 2px 5px)',
              }}
            />
          </div>
          <p className="text-center text-sm font-semibold tracking-widest text-text">
            {delivery.code}
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-textMuted">Pengirim</dt>
              <dd className="font-semibold text-text">{delivery.origin}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-textMuted">Penerima</dt>
              <dd className="font-semibold text-text">{delivery.destination}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-textMuted">Kurir</dt>
              <dd className="font-semibold text-text">{delivery.courierName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-textMuted">Jarak</dt>
              <dd className="font-semibold text-text">{delivery.distanceKm} km</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-textMuted">Tanggal</dt>
              <dd className="font-semibold text-text">{formatDate(delivery.scheduledAt)}</dd>
            </div>
          </dl>
          <p className="border-t border-dashed border-borderSoft pt-3 text-center text-xs text-textMuted">
            Terima kasih telah menggunakan layanan StokRSD WMS.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
