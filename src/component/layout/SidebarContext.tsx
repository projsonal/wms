'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const COLLAPSE_STORAGE_KEY = 'wms_sidebar_collapsed';

interface SidebarStateContextValue {
  /** Sidebar desktop: true = lebar penuh (dengan label), false = ciut (ikon saja). */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  /** Sidebar mobile: drawer overlay, default tertutup. */
  isMobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
}

const SidebarStateContext = createContext<SidebarStateContextValue | undefined>(undefined);

export function SidebarStateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Preferensi collapse desktop disimpan lokal supaya konsisten antar halaman/kunjungan.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  return (
    <SidebarStateContext.Provider
      value={{ isCollapsed, toggleCollapsed, isMobileOpen, openMobile, closeMobile }}
    >
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState(): SidebarStateContextValue {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    throw new Error('useSidebarState harus dipakai di dalam <SidebarStateProvider>');
  }
  return ctx;
}
