import { describe, expect, it } from 'vitest'
import { generateShortId, isShortId, SHORT_ID_LENGTH } from './shortId'

describe('generateShortId (v1.17.0)', () => {
  it('10 caracteres base62', () => {
    for (let i = 0; i < 200; i += 1) expect(generateShortId()).toMatch(/^[A-Za-z0-9]{10}$/)
    expect(SHORT_ID_LENGTH).toBe(10)
  })

  it('no se repite en 5000 generaciones', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateShortId()))
    expect(ids.size).toBe(5000)
  })

  it('descarta bytes >= 248 para no sesgar (usa solo los aceptables)', () => {
    let call = 0
    const random = (bytes) => {
      call += 1
      bytes.fill(call === 1 ? 255 : 0) // primera tanda: todos descartables
      return bytes
    }
    expect(generateShortId(random)).toBe('AAAAAAAAAA')
    expect(call).toBe(2)
  })

  it('isShortId reconoce solo el formato corto', () => {
    expect(isShortId(generateShortId())).toBe(true)
    for (const value of ['eyJ2IjoyLCJlIjoiZXZ0LTEifQ', 'AKP-2026-token-v1', 'short', 'Ab3xK9pQ2mX', undefined, 12345]) expect(isShortId(value)).toBe(false)
  })
})
