'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { ReportDownloadButton } from '@/component/laporan/ReportDownloadButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { laporanApi } from '@/lib/api/modules';
import { printRowsToPdf } from '@/lib/utils/export-pdf';

type Granularitas = 'harian' | 'bulanan' | 'tahunan';

interface ReportPageTemplateProps {
  title: string;
  breadcrumb: string;

  reportType?: string;

  hasDateGranularity?: boolean;
}

function toGenericRows(headers: string[], rows: string[][]): Array<Record<string, string> & { _id: string }> {
  return rows.map((row, idx) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return { ...obj, _id: String(idx) };
  });
}

const GRANULARITAS_OPTIONS: { value: Granularitas; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'tahunan', label: 'Tahunan' },
];

export function ReportPageTemplate({
  title,
  breadcrumb,
  reportType,
  hasDateGranularity = true,
}: Readonly<ReportPageTemplateProps>): React.JSX.Element {
  const { user } = useAuth();
  const [granularitas, setGranularitas] = useState<Granularitas>('bulanan');
  const { data, isLoading } = useSWR(
    reportType ? ['laporan-preview', reportType, hasDateGranularity ? granularitas : null] : null,
    () => laporanApi.preview(reportType as string, undefined, undefined, hasDateGranularity ? granularitas : undefined),
  );

  const headers = data?.headers ?? [];
  const genericRows = toGenericRows(headers, data?.rows ?? []);
  const columns: DataTableColumn<(typeof genericRows)[number]>[] = headers.map((h) => ({
    key: h,
    header: h,
    render: (row) => row[h] ?? '-',
  }));

  const chartRows =
    data?.chart?.labels.map((label, i) => ({
      label,
      value: data.chart?.values[i] ?? 0,
    })) ?? [];

  function handlePrint(): void {
    printRowsToPdf(
      genericRows,
      headers.map((h) => ({ header: h, accessor: (row: (typeof genericRows)[number]) => row[h] ?? '-' })),
      {
        title: `Rekap Data Gudang — ${title}`,
        subtitle: breadcrumb,
        description: `Rincian data laporan "${title}" langsung dari database, sesuai periode berjalan.`,
        generatedBy: user?.fullName,
      },
    );
  }

  let chartContent: React.JSX.Element;
  if (isLoading) {
    chartContent = <p className="flex h-full items-center justify-center text-xs text-textMuted">Memuat chart...</p>;
  } else if (chartRows.length === 0) {
    chartContent = (
      <p className="flex h-full items-center justify-center text-center text-xs text-textMuted">
        Belum ada data yang cukup untuk periode ini.
      </p>
    );
  } else {
    chartContent = (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7b74' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#8a7b74' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0dad2', fontSize: 12 }} />
          <Bar dataKey="value" fill="#b3471f" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <PageShell
      title={title}
      breadcrumb={breadcrumb}
      action={reportType ? <ReportDownloadButton reportType={reportType} granularitas={hasDateGranularity ? granularitas : undefined} /> : undefined}
    >
      {reportType ? (
        <>
          <StatsRow
            stats={(data?.summary ?? []).map((s, i) => ({
              id: String(i),
              label: s.label,
              value: s.value,
            }))}
          />

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text">
                Analisa Data{data?.chart?.title ? ` — ${data.chart.title}` : ''}
              </h2>
              {hasDateGranularity ? (
                <div className="flex gap-1.5">
                  {GRANULARITAS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGranularitas(opt.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        granularitas === opt.value ? 'bg-accent text-white' : 'text-textMuted hover:bg-surfaceAlt'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="h-64 w-full">
              {chartContent}
            </div>
          </Card>

          <DataTable
            title="Rincian Laporan"
            description="Detail transaksi dari database, sesuai periode berjalan"
            columns={columns}
            rows={genericRows}
            getRowId={(row) => row._id}
            isLoading={isLoading}

            visibleActions={['print']}
            onRowAction={(action) => {
              if (action === 'print') handlePrint();
            }}
          />
        </>
      ) : (
        <div className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-8 text-center text-sm text-textMuted">
          Laporan ini belum punya sumber data di backend (belum ada modul retur di database), jadi
          sengaja tidak ditampilkan data karangan di sini. Hubungi tim pengembang kalau modul ini
          perlu dibuatkan.
        </div>
      )}
    </PageShell>
  );
}
