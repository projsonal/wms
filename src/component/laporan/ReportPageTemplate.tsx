'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { ReportDownloadButton } from '@/component/laporan/ReportDownloadButton';
import { StatsRow } from '@/component/ui/StatsRow';
import { useAuth } from '@/auth/AuthContext';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { laporanApi } from '@/lib/api/modules';
import { printRowsToPdf, type PdfChartImage } from '@/lib/utils/export-pdf';
import { captureSvgAsPng, findChartSvg } from '@/lib/utils/chart-snapshot';

type Granularitas = 'harian' | 'bulanan' | 'tahunan';
type GenericRow = Record<string, string> & { _id: string };
type SummaryItem = { label: string; value: string | number };

interface ReportPageTemplateProps {
  title: string;
  breadcrumb: string;

  reportType?: string;

  hasDateGranularity?: boolean;
}

function toGenericRows(headers: string[], rows: string[][]): GenericRow[] {
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

const GRANULARITAS_LABEL: Record<Granularitas, string> = {
  harian: 'harian',
  bulanan: 'bulanan',
  tahunan: 'tahunan',
};

interface BuildColumnsArgs {
  headers: string[];
  isBulkMode: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

function buildColumns({ headers, isBulkMode, selectedIds, onToggle }: BuildColumnsArgs): DataTableColumn<GenericRow>[] {
  const selectColumn: DataTableColumn<GenericRow> = {
    key: 'select',
    header: '',
    render: (row) => (
      <input type="checkbox" checked={selectedIds.has(row._id)} onChange={() => onToggle(row._id)} className="h-4 w-4" />
    ),
  };
  const dataColumns: DataTableColumn<GenericRow>[] = headers.map((h) => ({
    key: h,
    header: h,
    render: (row) => row[h] ?? '-',
  }));
  return isBulkMode ? [selectColumn, ...dataColumns] : dataColumns;
}

interface BuildNarrativeArgs {
  title: string;
  hasDateGranularity: boolean;
  granularitas: Granularitas;
  rows: GenericRow[];
  totalRows: number;
  isFiltered: boolean;
  summary?: SummaryItem[];
}

function buildNarrative({ title, hasDateGranularity, granularitas, rows, totalRows, isFiltered, summary }: BuildNarrativeArgs): string[] {
  const paragraphs: string[] = [];
  const periodeText = hasDateGranularity ? ` untuk periode ${GRANULARITAS_LABEL[granularitas]} berjalan` : '';
  const cakupan = isFiltered
    ? `${rows.length} dari total ${totalRows} baris data (dipilih manual lewat mode Modify)`
    : `${rows.length} baris data`;
  paragraphs.push(
    `Laporan "${title}" ini disusun otomatis dari data transaksi tercatat di sistem${periodeText}, mencakup ${cakupan}.`,
  );
  if (summary && summary.length > 0) {
    const ringkasan = summary.map((s) => `${s.label}: ${s.value}`).join(', ');
    paragraphs.push(`Ringkasan angka kunci pada periode ini — ${ringkasan}.`);
  }
  return paragraphs;
}

function buildChartCaption(chartTitle?: string): string {
  if (!chartTitle) {
    return 'Analisa Data';
  }
  return `Analisa Data — ${chartTitle}`;
}

async function captureChartImage(container: HTMLElement | null, caption: string): Promise<PdfChartImage | undefined> {
  const svg = findChartSvg(container);
  if (!svg) return undefined;
  const snapshot = await captureSvgAsPng(svg);
  if (!snapshot) return undefined;
  return { dataUrl: snapshot.dataUrl, aspectRatio: snapshot.aspectRatio, caption };
}

function renderChartContent(isLoading: boolean, chartRows: { label: string; value: number }[]): React.JSX.Element {
  if (isLoading) {
    return <p className="flex h-full items-center justify-center text-xs text-textMuted">Memuat chart...</p>;
  }
  if (chartRows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-center text-xs text-textMuted">
        Belum ada data yang cukup untuk periode ini.
      </p>
    );
  }
  return (
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

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const headers = data?.headers ?? [];
  const genericRows = toGenericRows(headers, data?.rows ?? []);
  const isFiltered = isBulkMode && selectedIds.size > 0;
  const rowsToUse = isFiltered ? genericRows.filter((row) => selectedIds.has(row._id)) : genericRows;

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columns = buildColumns({ headers, isBulkMode, selectedIds, onToggle: toggleSelected });

  const chartRows =
    data?.chart?.labels.map((label, i) => ({
      label,
      value: data.chart?.values[i] ?? 0,
    })) ?? [];

  const exportColumns = headers.map((h) => ({ header: h, accessor: (row: GenericRow) => row[h] ?? '-' }));
  const narrative = buildNarrative({
    title,
    hasDateGranularity,
    granularitas,
    rows: rowsToUse,
    totalRows: genericRows.length,
    isFiltered,
    summary: data?.summary,
  });
  const pdfMeta = {
    title: `Rekap Data Gudang ${title}`,
    subtitle: breadcrumb,
    description: `Rincian data laporan "${title}" langsung dari database, sesuai periode berjalan.`,
    narrative,
  };

  async function handlePrint(): Promise<void> {
    const chartImage = await captureChartImage(chartContainerRef.current, buildChartCaption(data?.chart?.title));
    printRowsToPdf(rowsToUse, exportColumns, { ...pdfMeta, chartImage, generatedBy: user?.fullName });
  }

  async function handleExport(): Promise<void> {
    const chartImage = await captureChartImage(chartContainerRef.current, buildChartCaption(data?.chart?.title));
    requestExport(rowsToUse, exportColumns, `rekap-${(reportType ?? title).toLowerCase().replace(/\s+/g, '-')}`, {
      ...pdfMeta,
      chartImage,
    });
  }

  function handleRowAction(action: string): void {
    if (action === 'print') {
      void handlePrint();
    } else if (action === 'export') {
      void handleExport();
    } else if (action === 'modify') {
      setIsBulkMode((prev) => !prev);
      setSelectedIds(new Set());
    }
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
            <div ref={chartContainerRef} className="h-64 w-full">
              {renderChartContent(isLoading, chartRows)}
            </div>
          </Card>

          <DataTable
            title="Rincian Laporan"
            description={
              isBulkMode
                ? `Mode Modify aktif — ${selectedIds.size} baris dipilih. Pilih baris lalu Cetak/Export untuk hanya menyertakan data terpilih.`
                : 'Detail transaksi dari database, sesuai periode berjalan'
            }
            columns={columns}
            rows={genericRows}
            getRowId={(row) => row._id}
            isLoading={isLoading}
            visibleActions={['print', 'export', 'modify']}
            onRowAction={handleRowAction}
          />
          {exportDialog}
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
