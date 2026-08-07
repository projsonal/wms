'use client'
import { useState } from 'react'
import { Bell, Check, Package, Truck, ClipboardList, ShoppingCart, ExternalLink } from 'lucide-react'
import { useNotifications, type Notif } from '@/lib/notifications-context'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/component/ui/popover'

const iconFor = (kind: string) => {
  switch (kind) {
    case 'in': return Package
    case 'out': return Package
    case 'ship': return Truck
    case 'po': return ShoppingCart
    case 'opname': return ClipboardList
    default: return Bell
  }
}

const hrefFor = (kind: string) => ({
  in: '/dashboard/barang-masuk',
  out: '/dashboard/barang-keluar',
  ship: '/dashboard/pengiriman',
  po: '/dashboard/po',
  opname: '/dashboard/stock-opname',
}[kind] || '/dashboard')

export function NotificationsBell() {
  const { notifs, unread, markAllRead, kindLabel } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (v) markAllRead() }}>
      <PopoverTrigger asChild>
        <button type="button" className="relative h-9 w-9 rounded-full hover:bg-brand-surfaceAlt grid place-items-center" aria-label="Notifikasi">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center animate-pulse">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[520px] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-surfaceAlt">
          <div>
            <h3 className="font-semibold">Notifikasi</h3>
            <p className="text-xs text-brand-textMuted">{notifs.length} aktivitas terbaru</p>
          </div>
          {unread > 0 && <button type='button' onClick={markAllRead} className="text-xs text-brand-accent hover:underline flex items-center gap-1"><Check className="h-3 w-3" /> Tandai dibaca</button>}
        </div>
        <div className="overflow-y-auto scrollbar-thin flex-1">
          {notifs.length === 0 ? (
            <div className="p-8 text-center text-brand-textMuted text-sm">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Belum ada notifikasi
            </div>
          ) : notifs.map((n: Notif, i: number) => {
            const Icon = iconFor(n.kind)
            const k = kindLabel(n.kind)
            return (
              <Link key={n.id + i} href={hrefFor(n.kind)} onClick={() => setOpen(false)}
                className="flex items-start gap-3 p-3 border-b border-brand-border hover:bg-brand-surfaceAlt transition-colors">
                <div className={`h-9 w-9 rounded-full grid place-items-center flex-shrink-0 ${k.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    <span className="text-[10px] text-brand-textMuted whitespace-nowrap">{n.time}</span>
                  </div>
                  <p className="text-xs text-brand-textMuted truncate">{n.body}</p>
                </div>
                <ExternalLink className="h-3 w-3 text-brand-textMuted flex-shrink-0 mt-2" />
              </Link>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
