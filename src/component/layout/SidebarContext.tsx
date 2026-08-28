'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const COLLAPSE_STORAGE_KEY = 'wms_sidebar_collapsed';

interface SidebarStateContextValue {

  isCollapsed: boolean;
  toggleCollapsed: () => void;

  isMobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
}

const SidebarStateContext = createContext<SidebarStateContextValue | undefined>(undefined);

export function SidebarStateProvider({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

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

  const contextValue = useMemo(
    () => ({ isCollapsed, toggleCollapsed, isMobileOpen, openMobile, closeMobile }),
    [isCollapsed, toggleCollapsed, isMobileOpen, openMobile, closeMobile],
  );

  return (
    <SidebarStateContext.Provider value={contextValue}>
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
