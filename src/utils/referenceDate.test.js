import { describe, expect, it } from 'vitest'
import { referenceDateFor } from './referenceDate'

describe('fecha de referencia', () => {
  it('siempre cae en el 31 de diciembre del año de inicio', () => expect(referenceDateFor('2026-09-19')).toBe('2026-12-31'))
  it('funciona para cualquier año', () => expect(referenceDateFor('2027-01-05')).toBe('2027-12-31'))
})
