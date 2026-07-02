export const PWA_DISMISS_KEY = 'pwa-dismissed'
export const PWA_DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export function hasActivePwaDismissal(storage, now = Date.now()) {
  const dismissedAt = Number(storage?.getItem(PWA_DISMISS_KEY))
  return Number.isFinite(dismissedAt) && dismissedAt > 0 && now - dismissedAt < PWA_DISMISS_MS
}

export function dismissPwaBanner(storage, now = Date.now()) {
  storage?.setItem(PWA_DISMISS_KEY, String(now))
}
