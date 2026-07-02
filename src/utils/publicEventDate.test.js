import { describe, expect, it } from 'vitest'
import { formatPublicEventDate } from './publicEventDate'

describe('fecha pública del evento', () => {
  it('formatea un día', () => expect(formatPublicEventDate('2026-12-15')).toBe('15 de diciembre de 2026'))
  it('formatea un rango del mismo mes', () => expect(formatPublicEventDate('2026-06-18', '2026-06-19')).toBe('18 y 19 de junio de 2026'))
  it('maneja fechas faltantes', () => expect(formatPublicEventDate('')).toBe('Fecha por confirmar'))
})
