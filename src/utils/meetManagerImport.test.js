import fs from 'node:fs'
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
    expect(event).toMatchObject({ name: 'Copa MM', status: 'draft', venue: '', reference_date: '2026-12-15' })
    expect(event.clubs[0]).toMatchObject({ short_name: 'MANTARRAYAS', abbreviation: 'MNT' })
    expect(event.clubs[1].abbreviation).toBe('DLF')
    expect(event.events[0]).toMatchObject({ event_ptr: 1, active: true })
  })
  it('rechaza configuraciones incompletas', () => {
    expect(() => parseMeetManagerConfig({ ...valid, teams: [] })).toThrow('al menos un equipo')
    expect(() => parseMeetManagerConfig({ ...valid, meet: {} })).toThrow('nombre del evento')
  })
  it('acepta edades unicas, distancias y estilos abiertos, y normaliza sexo y curso', () => {
    const event = parseMeetManagerConfig({
      ...valid,
      meet: { ...valid.meet, venue: '', course: '2' },
      events: [
        { event_ptr: 1, distance: 1500, style: 'Estilo Local', age_lo: 4, age_hi: 4, sex: 'X' },
        { event_ptr: 2, distance: 800, style: 'Relevo Especial', age_lo: 5, age_hi: 5, sex: 'B' },
        { event_ptr: 3, distance: 400, style: 'Crawl', age_lo: 6, age_hi: 7, sex: 'W' }
      ]
    })
    expect(event).toMatchObject({ venue: '', course: 'S', reference_date: '2026-12-15' })
    expect(event.events.map(item => item.sex)).toEqual(['F', 'X', 'F'])
    expect(event.events[0]).toMatchObject({ distance: 1500, style: 'Estilo Local', age_lo: 4, age_hi: 4 })
  })
  it('rechaza solo campos esenciales invalidos', () => {
    expect(() => parseMeetManagerConfig({ ...valid, events: [{ ...valid.events[0], distance: 0 }] })).toThrow('prueba 1')
    expect(() => parseMeetManagerConfig({ ...valid, events: [{ ...valid.events[0], age_hi: 7, age_lo: 8 }] })).toThrow('prueba 1')
    expect(() => parseMeetManagerConfig({ ...valid, events: [{ ...valid.events[0], style: ' ' }] })).toThrow('prueba 1')
  })
  it('importa el JSON real indicado por REAL_MM_CONFIG', () => {
    if (!process.env.REAL_MM_CONFIG) return
    const event = parseMeetManagerConfig(JSON.parse(fs.readFileSync(process.env.REAL_MM_CONFIG, 'utf8')))
    expect(event.clubs).toHaveLength(11)
    expect(event.events).toHaveLength(82)
    expect(event.events.some(item => item.age_lo === 4 && item.age_hi === 4)).toBe(true)
    expect(event.events.every(item => ['F', 'M', 'X'].includes(item.sex))).toBe(true)
    expect(event.venue).toBe('')
  })
})
