'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api/api'
import { toast } from 'sonner'

export interface Notif { id: string; title: string; body: string; kind: string; time: string; created_at: string }

const ASSET_NOTIF_PREF_KEY = 'wms_notif_asset_enabled'

/** Preferensi "Notifikasi Aset" (Settings -> Notifikasi) — default AKTIF.
 * Disimpan lokal per-perangkat (bukan per-akun di server) karena memang
 * cuma soal "tampilkan/jangan tampilkan toast di browser ini", bukan
 * pengaturan bisnis yang perlu tersinkron lintas perangkat. */
export function isAssetNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(ASSET_NOTIF_PREF_KEY)
  return stored === null ? true : stored === '1'
}

export function setAssetNotifEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ASSET_NOTIF_PREF_KEY, enabled ? '1' : '0')
}

const KIND_LABELS: Record<string, { color: string; icon: string }> = {
  in: { color: 'bg-state-successBg text-state-successText', icon: '📦' },
  out: { color: 'bg-state-warningBg text-state-warningText', icon: '📤' },
  ship: { color: 'bg-state-infoBg text-state-infoText', icon: '🚚' },
  po: { color: 'bg-brand-accentSoft text-brand-accent', icon: '🛒' },
  opname: { color: 'bg-brand-surfaceAlt text-brand-textMuted', icon: '📋' },
  new_asset: { color: 'bg-state-warningBg text-state-warningText', icon: '📍' },
  barang_rusak: { color: 'bg-state-dangerBg text-state-dangerText', icon: '⚠️' },
  new_item: { color: 'bg-state-successBg text-state-successText', icon: '✨' },
}

interface Ctx {
  notifs: Notif[]
  unread: number
  markAllRead: () => void
  kindLabel: (k: string) => { color: string; icon: string }
  requestPushPermission: () => Promise<NotificationPermission>
  pushEnabled: boolean
}
const NotifCtx = createContext<Ctx | null>(null)

// Register service worker & request permission
async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch { return null }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const lastSeenRef = useRef<string>('')
  const initRef = useRef(false)
  const swRef = useRef<ServiceWorkerRegistration | null>(null)

  const kindLabel = useCallback((k: string) => KIND_LABELS[k] || KIND_LABELS.opname, [])
  const markAllRead = useCallback(() => { setUnread(0) }, [])

  const requestPushPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied' as NotificationPermission
    const p = await Notification.requestPermission()
    setPushEnabled(p === 'granted')
    return p
  }, [])

  // Register SW on mount
  useEffect(() => {
    (async () => {
      swRef.current = await registerSW()
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPushEnabled(Notification.permission === 'granted')
      }
    })()
  }, [])

  // Fire push (works even when tab hidden)
  const firePush = useCallback((n: Notif) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const k = kindLabel(n.kind)
    const body = `${k.icon} ${n.body}`
    // Use service worker registration if available (works when tab in background)
    if (swRef.current && swRef.current.active) {
      swRef.current.active.postMessage({ type: 'notify', payload: { title: n.title, body, tag: n.id } })
    } else {
      try { new Notification(n.title, { body, icon: '/assets/icon_wms.ico', tag: n.id }) } catch {}
    }
  }, [kindLabel])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const url = lastSeenRef.current ? `/dashboard/notifications?since=${encodeURIComponent(lastSeenRef.current)}` : '/dashboard/notifications'
        const r = await api<Notif[]>(url)
        if (r.success && Array.isArray(r.data)) {
          const items = r.data.filter((n) => (n.kind !== 'new_asset' && n.kind !== 'barang_rusak') || isAssetNotifEnabled())
          if (!initRef.current) {
            setNotifs(items)
            if (items.length) lastSeenRef.current = items[0].created_at
            initRef.current = true
            return
          }
          if (items.length) {
            setNotifs(prev => [...items, ...prev].slice(0, 30))
            setUnread(u => u + items.length)
            lastSeenRef.current = items[0].created_at
            const n = items[0]
            const k = kindLabel(n.kind)
            toast(`${k.icon} ${n.title}`, { description: n.body, duration: 4500 })
            firePush(n)
          }
        }
      } catch {}
    }
    poll()
    const t = setInterval(() => { if (!cancelled) poll() }, 15000)
    return () => { cancelled = true; clearInterval(t) }
  }, [firePush, kindLabel])

  return <NotifCtx.Provider value={{ notifs, unread, markAllRead, kindLabel, requestPushPermission, pushEnabled }}>{children}</NotifCtx.Provider>
}

export function useNotifications() {
  const c = useContext(NotifCtx)
  if (!c) return {
    notifs: [], unread: 0, markAllRead: () => {},
    kindLabel: () => ({ color: '', icon: '' }),
    requestPushPermission: async () => 'denied' as NotificationPermission,
    pushEnabled: false,
  }
  return c
}
