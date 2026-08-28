'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { notificationApi, type AppNotification } from '@/lib/api/modules';
import { isAssetNotifEnabled, isStockNotifEnabled } from '@/lib/notifications-context';
import { friendlyError } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const POLL_INTERVAL_MS = 60 * 1000;

const SWIPE_REVEAL_PX = 88;
const SWIPE_DELETE_THRESHOLD_PX = 64;

const ASSET_NOTIF_TYPES = new Set(['barang_rusak', 'ping']);
const STOCK_NOTIF_TYPES = new Set(['stok_menipis']);

function isNotifVisible(type: string): boolean {
  if (ASSET_NOTIF_TYPES.has(type)) return isAssetNotifEnabled();
  if (STOCK_NOTIF_TYPES.has(type)) return isStockNotifEnabled();
  return true;
}

const NOTIF_TYPE_ICON: Record<string, string> = {
  barang_rusak: '🛠️',
  ping: '📡',
  maintenance: '⚙️',
  trash: '🗑️',

  po: '📝',
  in: '📥',
  out: '📤',
  ship: '🚚',
  opname: '🔍',
};

export function NotificationBell(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const touchStateRef = useRef<{ id: number; startX: number; startY: number; isHorizontal: boolean | null } | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<number, number>>({});

  function handleSwipeTouchStart(itemId: number, event: React.TouchEvent<HTMLDivElement>): void {
    const touch = event.touches[0];
    touchStateRef.current = { id: itemId, startX: touch.clientX, startY: touch.clientY, isHorizontal: null };
  }

  function handleSwipeTouchMove(itemId: number, event: React.TouchEvent<HTMLDivElement>): void {
    const state = touchStateRef.current;
    if (state?.id !== itemId) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;

    if (state.isHorizontal === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      state.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (state.isHorizontal === false) return;

    const clamped = Math.min(0, Math.max(deltaX, -SWIPE_REVEAL_PX * 1.3));
    setSwipeOffsets((prev) => ({ ...prev, [itemId]: clamped }));
  }

  function handleSwipeTouchEnd(item: AppNotification): void {
    const offset = swipeOffsets[item.id] ?? 0;
    touchStateRef.current = null;
    if (offset <= -SWIPE_DELETE_THRESHOLD_PX) {
      handleDelete(item);
      return;
    }

    setSwipeOffsets((prev) => ({ ...prev, [item.id]: 0 }));
  }

  async function loadUnreadCount(): Promise<void> {
    try {
      const res = await notificationApi.unreadCount();
      setUnreadCount(res.unreadCount);
    } catch {
      // diam saja — badge cuma indikator, tidak fatal kalau sesaat gagal
    }
  }

  useEffect(() => {

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  async function loadList(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await notificationApi.list({ pageSize: 20 });
      setItems(res.data.filter((item) => isNotifVisible(item.type)));
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat notifikasi.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggle(): void {
    const next = !isOpen;
    setIsOpen(next);
    if (next) loadList();
  }

  async function handleMarkAllRead(): Promise<void> {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null);
      setUnreadCount(0);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menandai semua notifikasi.'));
    }
  }

  async function handleItemClick(item: AppNotification): Promise<void> {
    if (!item.isRead) {
      try {
        await notificationApi.markRead(item.id);
        setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)) ?? null);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // diam saja — navigasi tetap jalan walau gagal menandai dibaca
      }
    }
    setIsOpen(false);
  }

  async function handleDelete(item: AppNotification): Promise<void> {

    setItems((prev) => prev?.filter((n) => n.id !== item.id) ?? null);
    if (!item.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationApi.remove(item.id);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus notifikasi.'));
      loadList();
      loadUnreadCount();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifikasi"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft text-text hover:bg-surfaceAlt"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-dangerText px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent p-0"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-borderSoft bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-borderSoft px-4 py-3">
              <h3 className="text-sm font-bold text-text">Notifikasi</h3>
              {items?.some((n) => !n.isRead) ? (
                <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold text-accentDark hover:underline">
                  Tandai semua dibaca
                </button>
              ) : null}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(() => {
                if (isLoading) {
                  return <p className="px-4 py-6 text-center text-xs text-textMuted">Memuat notifikasi...</p>;
                }
                if (!items || items.length === 0) {
                  return <p className="px-4 py-6 text-center text-xs text-textMuted">Belum ada notifikasi baru.</p>;
                }
                return items.map((item) => {
                  const content = (
                    <>
                      <p className="text-xs font-semibold text-text">
                        {NOTIF_TYPE_ICON[item.type] ?? '🔔'} {item.title}
                      </p>
                      {item.message ? <p className="text-xs text-textMuted">{item.message}</p> : null}
                      <p className="text-[10px] text-textMuted">{formatDate(item.createdAt)}</p>
                    </>
                  );
                  return (
                    <div key={item.id} className="relative overflow-hidden border-b border-borderSoft last:border-0">

                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        aria-label="Hapus notifikasi"
                        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center gap-1 bg-dangerText text-xs font-semibold text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </button>
                      <div
                        className={`group relative z-10 flex items-stretch bg-surface transition-transform hover:bg-neutralBg ${
                          item.isRead ? '' : 'bg-accentSoft'
                        }`}
                        style={{
                          transform: `translateX(${swipeOffsets[item.id] ?? 0}px)`,
                          transition: touchStateRef.current?.id === item.id ? 'none' : 'transform 200ms ease-out',
                        }}
                        onTouchStart={(event) => handleSwipeTouchStart(item.id, event)}
                        onTouchMove={(event) => handleSwipeTouchMove(item.id, event)}
                        onTouchEnd={() => handleSwipeTouchEnd(item)}
                      >

                        {item.linkHref ? (
                          <Link
                            href={item.linkHref}
                            onClick={() => handleItemClick(item)}
                            className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3"
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleItemClick(item)}
                            className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left"
                          >
                            {content}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          aria-label="Hapus notifikasi"
                          className="shrink-0 self-start rounded p-1.5 text-textMuted opacity-0 transition-opacity hover:bg-borderSoft hover:text-dangerText focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
