'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Card } from '@/component/ui/Card';
import { fadeUp } from '@/component/ui/motion';

export interface ActivityItem {
  id: string;
  message: string;
  timeAgo: string;
}

interface RecentActivityCardProps {
  items: ActivityItem[];

  errorMessage?: string;
}

const LIST_MAX_HEIGHT_CLASS = 'max-h-72';

const READ_STORAGE_KEY = 'wms.dashboardActivity.readIds';
const DISMISSED_STORAGE_KEY = 'wms.dashboardActivity.dismissedIds';
const MAX_STORED_IDS = 200;

function readIdSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-MAX_STORED_IDS)));
  } catch {
    // localStorage penuh/nonaktif (mis. mode private) -> abaikan, fitur ini
    // tidak kritikal, cukup gagal senyap daripada bikin halaman error.
  }
}

export function RecentActivityCard({ items, errorMessage }: Readonly<RecentActivityCardProps>): React.JSX.Element {

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {

    setReadIds(readIdSet(READ_STORAGE_KEY));
    setDismissedIds(readIdSet(DISMISSED_STORAGE_KEY));
  }, []);

  function handleMarkAllRead(): void {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id));
      writeIdSet(READ_STORAGE_KEY, next);
      return next;
    });
  }

  function handleMarkRead(id: string): void {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      writeIdSet(READ_STORAGE_KEY, next);
      return next;
    });
  }

  function handleDismiss(id: string): void {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      writeIdSet(DISMISSED_STORAGE_KEY, next);
      return next;
    });
  }

  const visibleItems = items.filter((item) => !dismissedIds.has(item.id));
  const hasUnread = visibleItems.some((item) => !readIds.has(item.id));
  const emptyMessage = items.length === 0 ? 'Belum ada aktivitas.' : 'Semua aktivitas sudah disembunyikan.';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">Aktivitas Terbaru</h2>
        {hasUnread ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="shrink-0 text-xs font-semibold text-accentDark hover:underline"
          >
            Tandai semua dibaca
          </button>
        ) : null}
      </div>

      {(() => {
        if (errorMessage) {
          return <p className="text-xs text-dangerText">{errorMessage}</p>;
        }
        if (visibleItems.length === 0) {
          return <p className="text-xs text-textMuted">{emptyMessage}</p>;
        }
        return (
        <ul className={`flex flex-col gap-1 overflow-y-auto pr-1 ${LIST_MAX_HEIGHT_CLASS}`}>
          {visibleItems.map((item, index) => {
            const isRead = readIds.has(item.id);
            return (
              <motion.li
                key={item.id}
                className="group relative -mx-2 flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-neutralBg"
                custom={index}
                initial="hidden"
                animate="show"
                variants={fadeUp}
              >
                <button
                  type="button"
                  onClick={() => handleMarkRead(item.id)}
                  aria-label={isRead ? 'Sudah dibaca' : 'Tandai sudah dibaca'}
                  className="mt-1.5 shrink-0"
                >
                  <motion.span
                    className={`block h-1.5 w-1.5 rounded-full ${isRead ? 'bg-borderSoft' : 'bg-accent'}`}
                    animate={isRead ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
                    transition={isRead ? undefined : { duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={isRead ? 'text-textMuted' : 'text-text'}>{item.message}</p>
                  <p className="text-xs text-textMuted">{item.timeAgo}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDismiss(item.id)}
                  aria-label="Hapus dari daftar aktivitas"
                  className="shrink-0 rounded p-1 text-textMuted opacity-0 transition-opacity hover:bg-borderSoft hover:text-dangerText focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            );
          })}
        </ul>
        );
      })()}
    </Card>
  );
}
