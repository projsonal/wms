'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

const RESET_THROTTLE_MS = 5000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'click'] as const;
const PREF_KEY = 'wms_auto_logout_enabled';

const PREF_CHANGED_EVENT = 'wms:auto-logout-pref-changed';

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
