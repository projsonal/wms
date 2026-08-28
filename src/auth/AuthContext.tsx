'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/lib/api/auth';
import { clearSession, getAccessToken, HttpError } from '@/lib/api/client';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;

  serverUnreachable: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(false);

  const refreshUser = useCallback(async () => {
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

      const status = err instanceof HttpError ? Number(err.code) : null;
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

    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    // Bersihkan sesi & redirect DULUAN — jangan sampai UI nyangkut kalau
    // request logout ke backend lambat/timeout/gagal. Token akses di
    // client sudah dihapus, jadi sesi lokal sudah berakhir baik server
    // sempat memproses logout-nya atau tidak.
    clearSession();
    setUser(null);
    authApi.logout().catch(() => {
      // Diam saja — gagal invalidasi token di server bukan alasan
      // menahan user di halaman ini.
    });
    // Hard navigation (bukan router.replace) supaya selalu lewat full
    // page reload — menghindari kondisi macet di navigasi client-side.
    window.location.href = '/login';
  }, []);

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
