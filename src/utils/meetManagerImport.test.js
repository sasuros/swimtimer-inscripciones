import { describe, expect, it } from 'vitest'
import { parseMeetManagerConfig } from './meetManagerImport'

const valid = {
  source: 'Meet Manager', source_version: '2.0',
  meet: { name: 'Copa MM', date_start: '2026-12-15', course: 'S' },
  teams: [{ code: 6, name: 'Mantarrayas de Baruta' }, { code: 20, name: 'Delfines Olímpicos' }],
  events: [{ event_ptr: 1, distance: 25, style: 'Crawl', age_lo: 8, age_hi: 9, sex: 'F' }]
}

describe('importador Meet Manager', () => {
  it('convierte el formato MM en un borrador completo', () => {
    const event = parseMeetManagerConfig(valid)
    expect(event).toMatchObject({ name: 'Copa MM', status: 'draft', venue: '', reference_date: '' })
    expect(event.clubs[0]).toMatchObject({ short_name: 'MANTARRAYAS', abbreviation: 'MNT' })
    expect(event.clubs[1].abbreviation).toBe('DLF')
    expect(event.events[0]).toMatchObject({ event_ptr: 1, active: true })
  })
  it('rechaza configuraciones incompletas', () => {
    expect(() => parseMeetManagerConfig({ ...valid, teams: [] })).toThrow('al menos un equipo')
    expect(() => parseMeetManagerConfig({ ...valid, meet: {} })).toThrow('nombre del evento')
  })
})
