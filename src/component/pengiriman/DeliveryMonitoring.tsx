'use client';

import Link from 'next/link';
import { PageShell } from '@/component/layout/PageShell';
import { Badge } from '@/component/ui/Badge';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { StatsRow } from '@/component/ui/StatsRow';
import { deliveriesApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_DELIVERIES } from '@/lib/data/sample-data';
import { formatDate } from '@/lib/utils/format';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import type { Delivery } from '@/types';

export function DeliveryMonitoringContent(): React.JSX.Element {
  const { rows, isLoading } = useResourceList(
    'delivery-monitoring',
    deliveriesApi,
    SEED_DELIVERIES,
  );

  const columns: DataTableColumn<Delivery>[] = [
    { key: 'code', header: 'Resi', render: (row) => row.code },
    { key: 'courier', header: 'Kurir', render: (row) => row.courierName },
    { key: 'destination', header: 'Tujuan', render: (row) => row.destination },
    { key: 'scheduled', header: 'Jadwal', render: (row) => formatDate(row.scheduledAt) },
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
          Lacak
        </Link>
      ),
    },
  ];

  return (
    <PageShell title="Monitoring Pengiriman" breadcrumb="Pengiriman / Monitoring Pengiriman">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Pengiriman', value: rows.length },
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
          {
            id: 'gagal',
            label: 'Gagal Kirim',
            value: rows.filter((r) => r.status === 'gagal').length,
          },
        ]}
      />
      <DataTable
        title="Status Real-time Pengiriman"
        description="Pantau posisi & status setiap resi yang sedang berjalan"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />
    </PageShell>
  );
}
