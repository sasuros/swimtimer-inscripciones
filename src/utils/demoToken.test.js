import { describe, expect, it } from 'vitest'
import { accessFromDemoToken, decodeDemoToken, encodeDemoToken } from './demoToken'

describe('tokens autocontenidos de demo', () => {
  it('conserva acentos y pruebas compactas en menos de 8000 caracteres', () => {
    const events = Array.from({ length: 76 }, (_, index) => ({
      event_ptr: index + 1, distance: 50, style: 'Comb. Individual',
      age_lo: 8, age_hi: 9, sex: index % 2 ? 'F' : 'M', active: true
    }))
    const token = encodeDemoToken({
      id: 'copa-2026', name: 'Copa Aniversario José María', date_start: '2026-12-14',
      venue: 'Centro Portugués', reference_date: '2026-12-14', deadline: '2026-12-01',
      organizer_whatsapp: '584121234567', status: 'active', events
    }, { code: 7, name: 'Pan de Azúcar', abbreviation: 'PDA' })

    expect(token.length).toBeLessThan(8000)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    const access = accessFromDemoToken(decodeDemoToken(token))
    expect(access.event.name).toBe('Copa Aniversario José María')
    expect(access.club.name).toBe('Pan de Azúcar')
    expect(access.event.events).toHaveLength(76)
    expect(access.event.events[0]).toMatchObject({ event_ptr: 1, active: true })
  })
})
