'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { clearSession, getAccessToken, HttpError } from '@/lib/api/client';
import { getDemoUser, setDemoUser } from '@/auth/demo';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** true kalau percobaan terakhir memuat sesi gagal karena backend TIDAK
   * BISA DIHUBUNGI (5xx / gagal jaringan) — BEDA dari "belum login". Dipakai
   * RoleGuard untuk menampilkan halaman status 503 alih-alih diam-diam
   * melempar ke /login, yang menyesatkan kalau masalahnya sebenarnya
   * server sedang down, bukan user belum masuk. */
  serverUnreachable: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const demoUser = getDemoUser();
    if (demoUser) {
      setUser(demoUser);
      setServerUnreachable(false);
      setIsLoading(false);
      return;
    }
    if (!getAccessToken()) {
      setUser(null);
      setServerUnreachable(false);
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      setServerUnreachable(false);
    } catch (err) {
      // Status 5xx (server error/gateway) ATAU error jaringan (fetch
      // gagal total, mis. backend mati/tidak bisa dihubungi) BUKAN berarti
      // "sesi tidak valid" — token bisa saja masih sah, cuma servernya
      // yang sedang bermasalah. Untuk kasus ini JANGAN hapus sesi &
      // JANGAN anggap "belum login" (supaya begitu server pulih, sesi
      // yang sama otomatis jalan lagi tanpa user harus login ulang).
      const status = err instanceof HttpError ? Number(err.status) : null;
      const isServerOrNetworkIssue = err instanceof TypeError || (status !== null && status >= 500);
      if (isServerOrNetworkIssue) {
        setServerUnreachable(true);
      } else {
        clearSession();
        setUser(null);
        setServerUnreachable(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Memuat sesi pengguna sekali saat aplikasi pertama kali dimuat.
    // refreshUser() sendiri bersifat async (setState terjadi setelah
    // await), jadi ini bukan pola "setState sinkron dalam efek" yang
    // ingin dicegah aturan react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    const demoUser = getDemoUser();
    try {
      if (demoUser) {
        setDemoUser(null);
      } else {
        await authApi.logout();
      }
    } finally {
      clearSession();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, serverUnreachable, refreshUser, logout }),
    [user, isLoading, serverUnreachable, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }
  return context;
}
