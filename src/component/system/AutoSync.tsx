'use client';

import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';

const PREF_KEY = 'wms_auto_sync_enabled';
const SYNC_INTERVAL_MS = 30 * 1000;

const PREF_CHANGED_EVENT = 'wms:auto-sync-pref-changed';

// Sinkronisasi otomatis AKTIF SECARA DEFAULT — user tidak perlu menyalakannya
// dulu lewat Pengaturan supaya data ter-update sendiri. Preferensi di
// localStorage cuma dipakai kalau user secara eksplisit MEMATIKANNYA ('0').
export function isAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(PREF_KEY) !== '0';
}

export function setAutoSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new Event(PREF_CHANGED_EVENT));
}

export function AutoSyncRunner(): null {
  const { mutate } = useSWRConfig();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimer(): void {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function runSync(): void {

      mutate(() => true, undefined, { revalidate: true });
    }

    function armTimer(): void {
      clearTimer();
      intervalRef.current = window.setInterval(runSync, SYNC_INTERVAL_MS);
    }

    function handlePrefChanged(): void {
      if (isAutoSyncEnabled()) {
        armTimer();
      } else {
        clearTimer();
      }
    }

    if (isAutoSyncEnabled()) {
      armTimer();
    }

    window.addEventListener(PREF_CHANGED_EVENT, handlePrefChanged);
    window.addEventListener('storage', handlePrefChanged);

    return () => {
      window.removeEventListener(PREF_CHANGED_EVENT, handlePrefChanged);
      window.removeEventListener('storage', handlePrefChanged);
      clearTimer();
    };
  }, [mutate]);

  return null;
}
