'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 menit, sesuai label di Settings -> Keamanan
// Jangan reset timer di TIAP event aktivitas (mousemove bisa nembak ratusan
// kali/detik) — cukup catat ulang paling sering tiap RESET_THROTTLE_MS,
// selisihnya diabaikan karena tidak berarti apa-apa dibanding ambang 30
// menit. Ini murni soal mengurangi kerja clearTimeout/setTimeout yang
// tidak perlu, bukan soal akurasi.
const RESET_THROTTLE_MS = 5000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'click'] as const;
const PREF_KEY = 'wms_auto_logout_enabled';
// Custom event supaya tab yang SAMA langsung tahu preferensi berubah saat
// user toggle di Settings -> Keamanan (event bawaan browser `storage` cuma
// menyala di tab LAIN, bukan tab yang melakukan perubahan itu sendiri).
const PREF_CHANGED_EVENT = 'wms:auto-logout-pref-changed';

/** Preferensi "Sesi Otomatis Logout" (Settings -> Keamanan) — default AKTIF,
 * disimpan lokal per-perangkat (murni soal perilaku browser ini, bukan
 * pengaturan akun yang perlu tersinkron server). */
export function isAutoLogoutEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setAutoLogoutEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new Event(PREF_CHANGED_EVENT));
}

/**
 * Logout otomatis kalau tidak ada aktivitas (mouse/keyboard/scroll/tap)
 * sama sekali selama 30 menit — dipasang SEKALI di layout area yang sudah
 * pasti login (lihat app/home/layout.tsx), bukan cuma toggle dekoratif
 * seperti sebelumnya (ToggleRow di SecurityTab dulu tidak tersambung ke
 * apa pun — klik-klik doang, tidak pernah benar-benar men-logout siapa
 * pun walau labelnya bilang begitu).
 *
 * SENGAJA tanpa modal peringatan/hitung mundur sebelum logout — langsung
 * logout + toast info setelahnya, supaya perilakunya tetap sederhana
 * sesuai yang diminta. Kalau nanti butuh peringatan "sesi akan berakhir
 * dalam 1 menit" dengan tombol "Tetap di sini", itu bisa ditambahkan di
 * atas fondasi ini (timer kedua yang lebih pendek).
 */
export function InactivityLogout(): null {
  const { logout } = useAuth();
  const timeoutRef = useRef<number | null>(null);
  const lastResetAtRef = useRef(0);

  useEffect(() => {
    function clearTimer(): void {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function armTimer(): void {
      clearTimer();
      timeoutRef.current = window.setTimeout(() => {
        toast.info('Kamu otomatis logout karena tidak ada aktivitas selama 30 menit.');
        logout();
      }, INACTIVITY_LIMIT_MS);
    }

    function handleActivity(): void {
      if (!isAutoLogoutEnabled()) return;
      const now = Date.now();
      if (now - lastResetAtRef.current < RESET_THROTTLE_MS) return;
      lastResetAtRef.current = now;
      armTimer();
    }

    function handlePrefChanged(): void {
      if (isAutoLogoutEnabled()) {
        lastResetAtRef.current = Date.now();
        armTimer();
      } else {
        clearTimer();
      }
    }

    if (isAutoLogoutEnabled()) {
      armTimer();
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    window.addEventListener(PREF_CHANGED_EVENT, handlePrefChanged);
    window.addEventListener('storage', handlePrefChanged);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      window.removeEventListener(PREF_CHANGED_EVENT, handlePrefChanged);
      window.removeEventListener('storage', handlePrefChanged);
      clearTimer();
    };
  }, [logout]);

  return null;
}
