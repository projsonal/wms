'use client';

import Link from 'next/link';
import { Badge } from '@/component/ui/Badge';
import { Card } from '@/component/ui/Card';
import { formatNumber } from '@/lib/utils/format';
import type { Item } from '@/types';

interface AttentionPanelProps {
  lowStockItems: Item[];
  lowStockLoading: boolean;
  lowStockError?: string;
}

interface SectionProps {
  title: string;
  viewAllHref: string;
  isLoading: boolean;
  errorMessage?: string;
  emptyMessage: string;
  children: React.ReactNode;
  hasItems: boolean;
}

function Section({ title, viewAllHref, isLoading, errorMessage, emptyMessage, children, hasItems }: Readonly<SectionProps>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-textMuted">{title}</h3>
        <Link href={viewAllHref} className="text-xs font-semibold text-accent hover:underline">
          Lihat semua
        </Link>
      </div>
      {(() => {
        if (errorMessage) return <p className="text-xs text-dangerText">{errorMessage}</p>;
        if (isLoading) return <p className="text-xs text-textMuted">Memuat...</p>;
        if (!hasItems) return <p className="text-xs text-textMuted">{emptyMessage}</p>;
        return <ul className="flex flex-col gap-1.5">{children}</ul>;
      })()}
    </div>
  );
}

export function AttentionPanel({
  lowStockItems,
  lowStockLoading,
  lowStockError,
}: Readonly<AttentionPanelProps>): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-text">Perlu Perhatian</h2>
        <p className="text-xs text-textMuted">Ringkasan yang butuh tindakan hari ini</p>
      </div>

      <Section
        title="Stok Menipis"
        viewAllHref="/kelola-barang"
        isLoading={lowStockLoading}
        errorMessage={lowStockError}
        emptyMessage="Tidak ada barang dengan stok menipis. "
        hasItems={lowStockItems.length > 0}
      >
        {lowStockItems.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-md border border-borderSoft px-3 py-2 text-xs"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{item.name}</p>
              <p className="text-textMuted">
                Sisa {formatNumber(item.stock)} {item.unit} (min. {formatNumber(item.minStock)})
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge label="Menipis" variant="warning" />

              <Link
                href="/barang-masuk"
                className="whitespace-nowrap text-[11px] font-semibold text-accent hover:underline"
              >
                Tambah Stok →
              </Link>
            </div>
          </li>
        ))}
      </Section>
    </Card>
  );
}
