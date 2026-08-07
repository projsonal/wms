'use client';

import Link from 'next/link';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { MapPlaceholder } from '@/component/ui/MapPlaceholder';
import { StatsRow } from '@/component/ui/StatsRow';
import { deliveriesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_DELIVERIES } from '@/lib/data/sample-data';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { Delivery } from '@/types';

export function PickupDropoffContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList('deliveries', deliveriesApi, SEED_DELIVERIES);

  const columns: DataTableColumn<Delivery>[] = [
    { key: 'code', header: 'Kode', render: (row) => row.code },
    { key: 'origin', header: 'Asal', render: (row) => row.origin },
    { key: 'destination', header: 'Tujuan', render: (row) => row.destination },
    { key: 'courier', header: 'Kurir', render: (row) => row.courierName },
    { key: 'distance', header: 'Jarak', align: 'right', render: (row) => `${row.distanceKm} km` },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = DELIVERY_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Link
          href={`/delivery/${row.id}`}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Lihat detail
        </Link>
      ),
    },
  ];

  return (
    <PageShell
      title="Pickup & Dropoff"
      breadcrumb="Menu Utama / Pickup & Dropoff"
      action={<Button>+ Jadwalkan Pickup</Button>}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Jadwal', value: rows.length },
          {
            id: 'menunggu',
            label: 'Menunggu',
            value: rows.filter((r) => r.status === 'menunggu').length,
          },
          {
            id: 'transit',
            label: 'Dalam Perjalanan',
            value: rows.filter((r) => r.status === 'perjalanan').length,
          },
          {
            id: 'terkirim',
            label: 'Terkirim',
            value: rows.filter((r) => r.status === 'terkirim').length,
          },
        ]}
      />
      <MapPlaceholder
        title="Peta Pickup & Dropoff Aktif"
        pins={[
          { label: 'Gudang Bandung Timur', x: 30, y: 40, variant: 'origin' },
          { label: 'Toko Sumber Rejeki', x: 65, y: 55, variant: 'destination' },
          { label: 'Minimarket Sejahtera', x: 45, y: 70, variant: 'destination' },
        ]}
      />
      <DataTable
        title="Daftar Pickup & Dropoff"
        description="Jadwal penjemputan dan pengantaran barang"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
