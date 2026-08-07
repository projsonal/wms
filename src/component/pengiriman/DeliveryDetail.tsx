'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { MapPlaceholder } from '@/component/ui/MapPlaceholder';
import { SEED_DELIVERIES } from '@/lib/data/sample-data';
import { formatDate } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';

export function DeliveryDetailContent(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const delivery = SEED_DELIVERIES.find((item) => item.id === params.id) ?? SEED_DELIVERIES[0]!;
  const meta = DELIVERY_STATUS_META[delivery.status];

  return (
    <PageShell
      title="Detail Lokasi Pengiriman"
      breadcrumb={`Pengiriman / ${delivery.code}`}
      action={
        <Link href={`/receipt/${delivery.id}`}>
          <Button variant="secondary">Cetak Resi</Button>
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <MapPlaceholder
          title={`Rute Pengiriman ${delivery.code}`}
          heightClassName="h-96"
          pins={[
            { label: delivery.origin, x: 28, y: 35, variant: 'origin' },
            { label: delivery.destination, x: 68, y: 62, variant: 'destination' },
          ]}
        />
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">{delivery.code}</h2>
              <Badge label={meta.label} variant={meta.variant} />
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-textMuted">Asal</dt>
                <dd className="font-semibold text-text">{delivery.origin}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-textMuted">Tujuan</dt>
                <dd className="font-semibold text-text">{delivery.destination}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-textMuted">Kurir</dt>
                <dd className="font-semibold text-text">{delivery.courierName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-textMuted">Jarak Tempuh</dt>
                <dd className="font-semibold text-text">{delivery.distanceKm} km</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-textMuted">Jadwal</dt>
                <dd className="font-semibold text-text">{formatDate(delivery.scheduledAt)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-text">Riwayat Status</h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex justify-between">
                <span className="text-text">Pesanan dibuat</span>
                <span className="text-xs text-textMuted">{formatDate(delivery.scheduledAt)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-text">Dijemput kurir</span>
                <span className="text-xs text-textMuted">-</span>
              </li>
              <li className="flex justify-between">
                <span className="text-text">Dalam perjalanan</span>
                <span className="text-xs text-textMuted">-</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
