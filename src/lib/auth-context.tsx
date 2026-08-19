'use client'
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api, tokenStore, type ApiResponse } from './api/api'

export type UserRole = 'super_admin' | 'admin' | 'karyawan'
export interface User {
  id: string; username: string; email?: string; full_name?: string;
  role_name: UserRole; two_factor_enabled?: boolean;
}

interface Ctx {
  user: User | null; loading: boolean;
  login: (u: string, p: string) => Promise<ApiResponse<{ access_token?: string; refresh_token?: string; user?: User }>>;
  verify2FA: (code: string) => Promise<ApiResponse<{ access_token?: string; refresh_token?: string; user?: User }>>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshMe = useCallback(async () => {
    if (!tokenStore.getAccess()) { setUser(null); return }
    const cached = tokenStore.getUser<User>()
    if (cached) { setUser(cached); return }
    const r = await api<User>('/auth/me')
    if (r.success && r.data) { setUser(r.data); tokenStore.setUser(r.data) }
    else { setUser(null) }
  }, [])

  useEffect(() => {
    const cached = tokenStore.getUser<User>()
    if (cached) setUser(cached)
    refreshMe().finally(() => setLoading(false))
  }, [refreshMe])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api<{ access_token?: string; refresh_token?: string; user?: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    if (r.success && r.data) {
      const d = r.data
      if (d.access_token) tokenStore.setAccess(d.access_token)
      if (d.refresh_token) tokenStore.setRefresh(d.refresh_token)
      if (d.user) { tokenStore.setUser(d.user); setUser(d.user) }
    }
    return r
  }, [])

  const verify2FA = useCallback(async (code: string) => {
    const r = await api<{ access_token?: string; refresh_token?: string; user?: User }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otp: code }) })
    if (r.success && r.data) {
      const d = r.data
      if (d.access_token) tokenStore.setAccess(d.access_token)
      if (d.refresh_token) tokenStore.setRefresh(d.refresh_token)
      if (d.user) { tokenStore.setUser(d.user); setUser(d.user) }
    }
    return r
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear(); setUser(null); router.push('/login')
  }, [router])

  const contextValue = useMemo(
    () => ({ user, loading, login, verify2FA, logout, refreshMe }),
    [user, loading, login, verify2FA, logout, refreshMe],
  )

  return <AuthCtx.Provider value={contextValue}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
