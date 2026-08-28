'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, FileSpreadsheet, FileText, File } from 'lucide-react';
import { Button } from '@/component/ui/Button';
import { downloadFile, HttpError } from '@/lib/api/client';

export type ReportFormat = 'Excel' | 'PDF' | 'Docs';

interface ReportDownloadButtonProps {

  reportType: string;

  granularitas?: 'harian' | 'bulanan' | 'tahunan';
}

const FORMAT_OPTIONS: { format: ReportFormat; label: string; icon: typeof FileText }[] = [
  { format: 'Excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { format: 'PDF', label: 'PDF (.pdf)', icon: FileText },
  { format: 'Docs', label: 'Word (.docx)', icon: File },
];

export function ReportDownloadButton({ reportType, granularitas }: Readonly<ReportDownloadButtonProps>): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<ReportFormat | null>(null);

  async function handleDownload(format: ReportFormat): Promise<void> {
    setIsOpen(false);
    setDownloadingFormat(format);
    try {
      const params = new URLSearchParams({ tipe: reportType, format });
      if (granularitas) params.set('granularitas', granularitas);
      await downloadFile(`/laporan/export?${params.toString()}`);
      toast.success(`Laporan berhasil diunduh (${format}).`);
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal mengunduh laporan, coba lagi.');
    } finally {
      setDownloadingFormat(null);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setIsOpen((prev) => !prev)} loading={Boolean(downloadingFormat)}>
        Unduh Laporan
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Tutup pilihan format laporan"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-md border border-borderSoft bg-surface py-1 shadow-card">
            {FORMAT_OPTIONS.map(({ format, label, icon: Icon }) => (
              <button
                key={format}
                type="button"
                onClick={() => handleDownload(format)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-neutralBg"
              >
                <Icon className="h-3.5 w-3.5 text-textMuted" />
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
