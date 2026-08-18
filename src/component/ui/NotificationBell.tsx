'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { useNotifications } from '@/lib/notifications-context';

/**
 * Icon bell notifikasi di header, sejajar dengan judul menu — tampil di
 * SEMUA halaman karena dipasang sekali di `Header.tsx` (bukan per-halaman),
 * dan `Header` dipakai oleh setiap `PageShell` di semua menu. Kalau di HP/
 * browser kamu bell-nya cuma kelihatan di satu menu, itu bukan karena
 * bell-nya cuma dipasang di situ — kemungkinan besar cache dev server lama
 * (coba hard refresh / restart `next dev`, lalu cek menu lain).
 *
 * Sumber datanya: `useNotifications()` dari `notifications-context.tsx`,
 * yaitu context yang SUDAH ADA sebelumnya (polling `GET
 * /dashboard/notifications` tiap 15 detik + toast + push notification) —
 * cuma sebelumnya tidak pernah dipakai UI mana pun, jadi seluruh
 * infrastrukturnya "nganggur" tanpa tombol bell. Sekarang disambungkan ke
 * sini alih-alih bikin state notifikasi baru yang terpisah/duplikat.
 *
 * PENTING: endpoint `GET /dashboard/notifications` itu sendiri BELUM ada
 * di backend gowms (dicek: tidak ada route-nya di router.go). Jadi untuk
 * sekarang polling-nya akan selalu gagal diam-diam (di-catch, tidak crash)
 * dan daftar notifikasi akan selalu kosong — bukan bug di komponen ini,
 * tapi memang endpoint backend-nya belum diimplementasikan.
 */
export function NotificationBell(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifs, unread, markAllRead, kindLabel } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        aria-expanded={isOpen}
        className={clsx(
          'relative flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft bg-surface text-textMuted transition-colors hover:border-accent hover:text-accent',
          isOpen && 'border-accent text-accent',
        )}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-dangerText px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-borderSoft px-4 py-3">
            <p className="text-sm font-semibold text-text">Notifikasi</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai dibaca semua
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-textMuted">Belum ada notifikasi baru.</p>
            ) : (
              <ul className="divide-y divide-borderSoft">
                {notifs.map((n) => {
                  const meta = kindLabel(n.kind);
                  return (
                    <li key={n.id} className="flex gap-3 px-4 py-3">
                      <span
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
                          meta.color,
                        )}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{n.title}</p>
                        <p className="text-xs text-textMuted">{n.body}</p>
                        <p className="mt-0.5 text-[11px] text-textMuted/70">{n.time}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
