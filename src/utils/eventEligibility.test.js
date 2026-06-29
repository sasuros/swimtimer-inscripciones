import { describe, expect, it } from 'vitest'
import { eventAllowsSex } from './eventEligibility'

describe('elegibilidad de sexo por prueba', () => {
  it('muestra pruebas mixtas X y B a ambos sexos', () => {
    expect(eventAllowsSex('X', 'F')).toBe(true)
    expect(eventAllowsSex('X', 'M')).toBe(true)
    expect(eventAllowsSex('B', 'F')).toBe(true)
    expect(eventAllowsSex('B', 'M')).toBe(true)
  })

  it('mantiene las pruebas exclusivas por sexo', () => {
    expect(eventAllowsSex('F', 'F')).toBe(true)
    expect(eventAllowsSex('F', 'M')).toBe(false)
    expect(eventAllowsSex('M', 'M')).toBe(true)
  })
})
