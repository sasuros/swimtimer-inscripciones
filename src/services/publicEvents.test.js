import { describe, expect, it } from 'vitest'
import { normalizePublicEventState, sortPublicEvents } from './publicEvents'

describe('estados de eventos públicos', () => {
  it('mantiene compatibilidad con los booleanos anteriores', () => {
    expect(normalizePublicEventState(true)).toBe('live')
    expect(normalizePublicEventState(false)).toBe('finished')
    expect(normalizePublicEventState(null)).toBe('upcoming')
  })

  it('ordena en vivo, próximamente y finalizado', () => {
    const events = sortPublicEvents([
      { id: 'finished', is_live: 'finished', date_start: '2026-06-01' },
      { id: 'upcoming', is_live: 'upcoming', date_start: '2026-08-01' },
      { id: 'live', is_live: 'live', date_start: '2026-07-01' },
    ])
    expect(events.map(event => event.id)).toEqual(['live', 'upcoming', 'finished'])
  })
})
