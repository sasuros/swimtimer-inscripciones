import { describe, expect, it } from 'vitest'
import { calculateAge, categoryForAge } from './ageCalculator'
import { formatTimeInput, validateTime } from './timeParser'
import { ATHLETE_FIELDS, RESULT_FIELDS, buildMMExport } from './mmSchema'
import { standardEventTemplate } from './eventTemplate'

describe('reglas de inscripción', () => {
  it('calcula la edad en la fecha de referencia', () => expect(calculateAge('2013-12-16', '2025-12-15')).toBe(11))
  it('ubica la categoría', () => expect(categoryForAge(12)?.label).toBe('12-13 Años'))
  it('exige centésimas', () => expect(validateTime('32.5')).toContain('centésimas'))
  it('acepta tiempos válidos', () => expect(validateTime('1:25.30')).toBe(''))
  it('exige dos dígitos de segundos cuando hay minutos', () => expect(validateTime('1:5.30')).not.toBe(''))
  it('autoformatea tiempos escritos sin separadores', () => { expect(formatTimeInput('3256')).toBe('32.56'); expect(formatTimeInput('10530')).toBe('1:05.30') })
  it('genera las 76 pruebas estándar', () => expect(standardEventTemplate()).toHaveLength(76))
  it('conserva los esquemas MM exactos', () => { expect(ATHLETE_FIELDS).toHaveLength(30); expect(RESULT_FIELDS).toHaveLength(87) })
  it('genera registros MM con todas las columnas', async () => {
    const output = await buildMMExport({ event: { name: 'Copa' }, club: { name: 'AKP', code: 2 }, token: 'demo', roster: [{ lastName: 'Suros', firstName: 'Ana', sex: 'F', birthDate: '2013-05-15', age: 12, events: [{ eventIndex: 0, time: '32.50' }] }] })
    expect(Object.keys(output.athletes[0])).toEqual(ATHLETE_FIELDS)
    expect(Object.keys(output.results[0])).toEqual(RESULT_FIELDS)
    expect(output.meta.sha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
