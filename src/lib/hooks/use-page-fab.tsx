'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface PageFabContextValue {
  registerActionFab: () => () => void;
  hasActionFab: boolean;
}

const PageFabContext = createContext<PageFabContextValue | undefined>(undefined);

export function PageFabProvider({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const countRef = useRef(0);
  const [hasActionFab, setHasActionFab] = useState(false);

  const registerActionFab = useCallback((): (() => void) => {
    countRef.current += 1;
    setHasActionFab(true);
    return () => {
      countRef.current = Math.max(0, countRef.current - 1);
      if (countRef.current === 0) {
        setHasActionFab(false);
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({ registerActionFab, hasActionFab }),
    [registerActionFab, hasActionFab],
  );

  return (
    <PageFabContext.Provider value={contextValue}>{children}</PageFabContext.Provider>
  );
}

export function useRegisterPageActionFab(active: boolean): void {
  const ctx = useContext(PageFabContext);
  useEffect(() => {
    if (!active || !ctx) {
      return;
    }
    return ctx.registerActionFab();
  }, [active, ctx]);
}

export function useHasPageActionFab(): boolean {
  const ctx = useContext(PageFabContext);
  return ctx?.hasActionFab ?? false;
}
