import { describe, expect, it } from 'vitest'
import { dismissPwaBanner, hasActivePwaDismissal, PWA_DISMISS_MS } from './pwaInstall'

const storage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
}

describe('banner de instalación PWA', () => {
  it('permanece oculto durante siete días después de cerrarlo', () => {
    const memory = storage()
    dismissPwaBanner(memory, 1000)
    expect(hasActivePwaDismissal(memory, 1000 + PWA_DISMISS_MS - 1)).toBe(true)
    expect(hasActivePwaDismissal(memory, 1000 + PWA_DISMISS_MS)).toBe(false)
  })
})
