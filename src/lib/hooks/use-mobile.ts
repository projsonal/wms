import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook standar shadcn/ui untuk mendeteksi viewport mobile (<768px).
 * Dipakai oleh `component/ui/shadcn/sidebar.tsx` untuk beralih ke mode
 * drawer di layar kecil.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (): void => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener('change', onChange);
    // Nilai awal ditentukan sekali di sini (bukan reaksi ke state lain),
    // sehingga aman dari aturan react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return Boolean(isMobile);
}
