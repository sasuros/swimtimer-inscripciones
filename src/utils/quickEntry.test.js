import { describe, expect, it } from 'vitest'
import { detectSeparator, isHeaderRow, normalizeBirthDate, parseQuickEntry, splitDelimitedLine } from './quickEntry'

const events = [
  { event_ptr: 1, distance: 25, style: 'Crawl', age_lo: 12, age_hi: 13, sex: 'F', active: true },
  { event_ptr: 2, distance: 50, style: 'Espalda', age_lo: 12, age_hi: 13, sex: 'M', active: true }
]
const options = { referenceDate: '2025-12-15', events }

describe('quick entry parser', () => {
  it('detects separators, quoted commas and headers', () => {
    expect(detectSeparator('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Tiempo')).toBe(',')
    expect(splitDelimitedLine('Lopez,"Carlos, José",M', ',')).toEqual(['Lopez', 'Carlos, José', 'M'])
    expect(isHeaderRow(['Apellido', 'Nombre', 'Sexo', 'Fecha Nac.', 'Evento', 'Tiempo'])).toBe(true)
  })

  it('accepts both supported date formats and validates real events', () => {
    const rows = parseQuickEntry('Apellido\tNombre\tSexo\tFecha Nac.\tEvento\tTiempo\nRodriguez\tMaria\tF\t15/05/2013\t25m Crawl\t32.56', options)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ birthDate: '2013-05-15', eventIndex: 1, errors: [] })
    expect(normalizeBirthDate('2013-05-15')).toBe('2013-05-15')
  })

  it('reports incomplete hundredths and contextual available events', () => {
    const [row] = parseQuickEntry('Lopez;Carlos;M;22/03/2012;200m Mariposa;28.9', options)
    expect(row.errors.join(' ')).toContain('Eventos disponibles para M, 13 años: 50m Espalda')
    expect(row.warnings.join(' ')).toContain('centésimas')
  })
})
