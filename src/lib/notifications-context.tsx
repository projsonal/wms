const ASSET_NOTIF_PREF_KEY = 'wms_notif_asset_enabled';

export function isAssetNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(ASSET_NOTIF_PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setAssetNotifEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ASSET_NOTIF_PREF_KEY, enabled ? '1' : '0');
}

const STOCK_NOTIF_PREF_KEY = 'wms_notif_stock_enabled';

export function isStockNotifEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STOCK_NOTIF_PREF_KEY);
  return stored === null ? true : stored === '1';
}

export function setStockNotifEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STOCK_NOTIF_PREF_KEY, enabled ? '1' : '0');
}
