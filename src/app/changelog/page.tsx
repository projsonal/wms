'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, Wrench } from 'lucide-react';
import { appInfoApi } from '@/lib/api/modules';

function VersionCard({
  version,
  date,
  changes,
  isLatest,
}: {
  version: string;
  date: string;
  changes: { new?: string[]; fix?: string[] };
  isLatest: boolean;
}): React.JSX.Element {
  return (
    <div className="relative flex flex-col gap-3 rounded-lg border border-borderSoft bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-text">{version}</h2>
        {isLatest ? (
          <span className="rounded-full bg-accentSoft px-2 py-0.5 text-[10px] font-semibold uppercase text-accentDark">
            Terbaru
          </span>
        ) : null}
      </div>
      <p className="text-xs text-textMuted">{date}</p>

      {changes.new && changes.new.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-successText">
            <CheckCircle2 className="h-3.5 w-3.5" /> Baru
          </p>
          <ul className="flex flex-col gap-1 pl-1">
            {changes.new.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text">
                <span className="mt-0.5 text-successText">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {changes.fix && changes.fix.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warningText">
            <Wrench className="h-3.5 w-3.5" /> Perbaikan
          </p>
          <ul className="flex flex-col gap-1 pl-1">
            {changes.fix.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text">
                <span className="mt-0.5 text-warningText">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function ChangelogPage(): React.JSX.Element {
  const { data: versionInfo } = useSWR('app-version', () => appInfoApi.version());
  const { data: entries, isLoading } = useSWR('app-changelog', () => appInfoApi.changelog());

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link href="/home/dashboard" className="flex items-center gap-1.5 text-xs font-semibold text-accentDark hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-text">{versionInfo?.appName ?? 'WMS-RSD'} — Riwayat Pembaruan</h1>
          <p className="text-sm text-textMuted">
            Versi berjalan saat ini: <span className="font-semibold text-text">{versionInfo?.version ?? '-'}</span>
          </p>
        </div>

        <div className="rounded-lg border border-borderSoft bg-surface p-5 shadow-card">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-textMuted">Tentang Aplikasi</h2>
          <p className="text-sm text-text">{versionInfo?.description ?? 'Memuat...'}</p>
          {versionInfo?.developer ? (
            <p className="mt-2 text-xs text-textMuted">Dikembangkan oleh {versionInfo.developer}</p>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-sm text-textMuted">Memuat riwayat pembaruan...</p>
        ) : (
          <div className="flex flex-col gap-4">
            {(entries ?? []).map((entry, index) => (
              <VersionCard
                key={entry.version}
                version={entry.version}
                date={entry.date}
                changes={entry.changes}
                isLatest={index === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
