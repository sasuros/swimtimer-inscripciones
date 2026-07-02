import { describe, expect, it } from 'vitest'
import { ensureClubPin, generateClubPin, normalizeClubPin } from './clubPin'

describe('PIN por club', () => {
  it('genera siempre cuatro dígitos entre 1000 y 9999', () => {
    expect(generateClubPin(values => { values[0] = 0 })).toBe('1000')
    expect(generateClubPin(values => { values[0] = 8999 })).toBe('9999')
  })

  it('normaliza y conserva un PIN válido', () => {
    expect(normalizeClubPin('12a34x')).toBe('1234')
    expect(ensureClubPin({ code: 6, pin: '4827' })).toMatchObject({ code: 6, pin: '4827' })
  })
})
