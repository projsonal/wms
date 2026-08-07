'use client'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshMe = useCallback(async () => {
    if (!tokenStore.getAccess()) { setUser(null); return }
    // If we have a cached user, use it — /auth/me requires bot-token which may not be set yet on page reload.
    const cached = tokenStore.getUser<User>()
    if (cached) { setUser(cached); return }
    const r = await api<User>('/auth/me')
    if (r.success && r.data) { setUser(r.data); tokenStore.setUser(r.data) }
    else { setUser(null) }
  }, [])

  useEffect(() => {
    // Nilai awal diambil sekali dari cache lokal saat mount (bukan reaksi
    // terhadap state React lain), lalu disusul refreshMe() yang bersifat
    // async — aman dari aturan react-hooks/set-state-in-effect.
    const cached = tokenStore.getUser<User>()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setUser(cached)
    refreshMe().finally(() => setLoading(false))
  }, [refreshMe])

  const login = async (username: string, password: string) => {
    const r = await api<{ access_token?: string; refresh_token?: string; user?: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    if (r.success && r.data) {
      const d = r.data
      if (d.access_token) tokenStore.setAccess(d.access_token)
      if (d.refresh_token) tokenStore.setRefresh(d.refresh_token)
      if (d.user) { tokenStore.setUser(d.user); setUser(d.user) }
    }
    return r
  }

  const verify2FA = async (code: string) => {
    const r = await api<{ access_token?: string; refresh_token?: string; user?: User }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otp: code }) })
    if (r.success && r.data) {
      const d = r.data
      if (d.access_token) tokenStore.setAccess(d.access_token)
      if (d.refresh_token) tokenStore.setRefresh(d.refresh_token)
      if (d.user) { tokenStore.setUser(d.user); setUser(d.user) }
    }
    return r
  }

  const logout = () => {
    tokenStore.clear(); setUser(null); router.push('/login')
  }

  return <AuthCtx.Provider value={{ user, loading, login, verify2FA, logout, refreshMe }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
