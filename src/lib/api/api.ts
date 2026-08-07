export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  errors?: unknown
  __needCaptcha?: boolean
}

const BOT_KEY = 'wms.botToken'
const BOT_TRUST_EXP_KEY = 'wms.botTrustExp'
const ACCESS_KEY = 'wms.accessToken'
const REFRESH_KEY = 'wms.refreshToken'
const USER_KEY = 'wms.user'
const TOUR_KEY = 'wms.tourDone'

export const tokenStore = {
  getBot(): string { return typeof window === 'undefined' ? '' : localStorage.getItem(BOT_KEY) || '' },
  setBot(t: string, trust24h = false) {
    if (typeof window === 'undefined') return
    localStorage.setItem(BOT_KEY, t)
    if (trust24h) localStorage.setItem(BOT_TRUST_EXP_KEY, String(Date.now() + 24 * 3600 * 1000))
  },
  hasTrustedDevice(): boolean {
    if (typeof window === 'undefined') return false
    const exp = Number(localStorage.getItem(BOT_TRUST_EXP_KEY) || 0)
    return exp > Date.now()
  },
  clearTrust() { if (typeof window !== 'undefined') { localStorage.removeItem(BOT_TRUST_EXP_KEY); localStorage.removeItem(BOT_KEY) } },
  getAccess(): string { return typeof window === 'undefined' ? '' : localStorage.getItem(ACCESS_KEY) || '' },
  setAccess(t: string) { if (typeof window !== 'undefined') localStorage.setItem(ACCESS_KEY, t) },
  getRefresh(): string { return typeof window === 'undefined' ? '' : localStorage.getItem(REFRESH_KEY) || '' },
  setRefresh(t: string) { if (typeof window !== 'undefined') localStorage.setItem(REFRESH_KEY, t) },
  getUser<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as T | null
    } catch {
      return null
    }
  },
  setUser(u: unknown) { if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(u)) },
  isTourDone(): boolean { return typeof window !== 'undefined' && localStorage.getItem(TOUR_KEY) === '1' },
  markTourDone() { if (typeof window !== 'undefined') localStorage.setItem(TOUR_KEY, '1') },
  clear() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY)
  },
}

export async function getCaptchaChallenge(): Promise<{ captcha_token: string; captcha_image_base64: string }> {
  const res = await fetch('/api/gostock/security/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const j = await res.json()
  if (j?.data?.captcha) return j.data.captcha
  throw new Error('Gagal mendapatkan captcha')
}

export async function solveCaptcha(captcha_token: string, captcha_answer: string, trust24h = false): Promise<string> {
  const res = await fetch('/api/gostock/security/challenge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captcha_token, captcha_answer }),
  })
  const j = await res.json()
  if (!j.success) throw new Error(j.message || 'Captcha salah')
  const bt = j.data?.bot_token
  if (bt) tokenStore.setBot(bt, trust24h)
  return bt
}

export async function api<T = unknown>(pathname: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')

  const bot = tokenStore.getBot()
  if (bot) headers.set('X-Bot-Token', bot)

  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)

  const url = resolveUrl(pathname)
  const res = await fetch(url, { ...init, headers })

  const newBot = res.headers.get('x-bot-token')
  if (newBot) tokenStore.setBot(newBot)

  let json: ApiResponse<T>
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    json = { success: false, message: `HTTP ${res.status}` }
  }

  if (res.status === 428) {
    tokenStore.setBot('')
    json.__needCaptcha = true
  }

  return json
}

function resolveUrl(pathname: string): string {
  if (pathname.startsWith('/api/')) {
    return pathname
  }
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `/api/gostock${normalized}`
}
