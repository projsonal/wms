'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Sebelum ini ada DUA floating action button independen yang bisa tampil
 * BERSAMAAN di HP: menu navigasi cepat global (`MobileFloatingMenu`,
 * dipasang sekali di `src/app/home/layout.tsx` untuk semua halaman) dan
 * FAB aksi tabel per-halaman (`TableRowActionBar` -> `MobileFabActionMenu`,
 * berisi Add/Change/Delete/Export/Print/Modify/Protect). Keduanya sama-sama
 * `fixed bottom-* right-*`, jadi di halaman manapun yang punya tabel,
 * pengguna melihat dua lingkaran "+" menumpuk.
 *
 * Context ini jadi penengah: komponen FAB aksi tabel "mendaftar" saat
 * mount (halaman ini punya menu aksinya sendiri, lebih spesifik & lebih
 * lengkap — sudah mencakup semua aksi yang ada di menu desktop), lalu
 * `MobileFloatingMenu` cukup baca `useHasPageActionFab()` dan sembunyikan
 * dirinya sendiri kalau true. Hasilnya: selalu hanya SATU FAB yang tampil
 * — FAB aksi tabel menang kalau ada, FAB navigasi jadi fallback di
 * halaman yang tidak punya tabel/aksi (mis. Dashboard).
 */
interface PageFabContextValue {
  registerActionFab: () => () => void;
  hasActionFab: boolean;
}

const PageFabContext = createContext<PageFabContextValue | undefined>(undefined);

export function PageFabProvider({ children }: { children: ReactNode }): React.JSX.Element {
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

  return (
    <PageFabContext.Provider value={{ registerActionFab, hasActionFab }}>{children}</PageFabContext.Provider>
  );
}

/** Dipakai oleh FAB aksi tabel: daftarkan diri selama komponennya aktif di layar. */
export function useRegisterPageActionFab(active: boolean): void {
  const ctx = useContext(PageFabContext);
  useEffect(() => {
    if (!active || !ctx) {
      return;
    }
    return ctx.registerActionFab();
  }, [active, ctx]);
}

/** Dipakai oleh FAB navigasi global: true kalau ada FAB aksi tabel aktif di halaman ini. */
export function useHasPageActionFab(): boolean {
  const ctx = useContext(PageFabContext);
  return ctx?.hasActionFab ?? false;
}
