import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeCsvBytes, parseQuickEntry, pendingText } from './quickEntry'
import { parseQuickEntry as legacyParse } from './testSupport/quickEntryLegacy'
import { standardEventTemplate } from './eventTemplate'

// v1.20.0 — estructura del archivo: encabezado por nombre, filas vacías, número de fila real
// y codificación de Excel en español.
const options = { referenceDate: '2026-10-17', events: standardEventTemplate() }
const parse = (text) => parseQuickEntry(text, options)
const ok = (row) => !row.errors.length && !row.warnings.length

describe('encabezado por nombre', () => {
  // EXCEPCIÓN aprobada al invariante: hoy esta fila "pasa" con nombre y apellido intercambiados.
  it('columnas en otro orden: con encabezado se leen por nombre (antes se intercambiaban sin avisar)', () => {
    const text = 'Nombre,Apellido,Sexo,Fecha Nac.,Evento,Tiempo\nMaria,Rodriguez,F,05/03/2017,25m Crawl,25.30'
    const [before] = legacyParse(text, options)
    expect([before.lastName, before.firstName]).toEqual(['Maria', 'Rodriguez']) // el error de hoy
    const [row] = parse(text)
    expect(ok(row)).toBe(true)
    expect([row.lastName, row.firstName]).toEqual(['Rodriguez', 'Maria'])
  })

  it('fecha y sexo intercambiados también se leen bien', () => {
    const [row] = parse('Apellido;Nombre;Fecha Nac.;Sexo;Tiempo;Evento\nRodriguez;Maria;05/03/2017;F;25.30;25m Crawl')
    expect(row).toMatchObject({ lastName: 'Rodriguez', firstName: 'Maria', sex: 'F', birthDate: '2017-03-05', label: '25m Crawl', time: '25.30', errors: [] })
  })

  it('tildes, mayúsculas y sinónimos en el encabezado', () => {
    const [row] = parse('APELLIDOS;NOMBRES;GÉNERO;FECHA DE NACIMIENTO;PRUEBA;MARCA\nRodriguez;Maria;F;05/03/2017;25m Crawl;25.30')
    expect(ok(row)).toBe(true)
  })

  it('encabezado incompleto pero en el orden de siempre: por posición, como hasta hoy', () => {
    const [row] = parse('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Time\nRodriguez,Maria,F,05/03/2017,25m Crawl,25.30')
    expect(ok(row)).toBe(true)
  })

  it('encabezado incompleto y desordenado: no se adivina, un solo mensaje con la columna que falta', () => {
    const rows = parse('Nombre,Apellido,Sexo,Evento,Fecha Nac.,Time\nMaria,Rodriguez,F,25m Crawl,05/03/2017,25.30')
    expect(rows).toHaveLength(1)
    expect(rows[0].rowIndex).toBe(1)
    expect(rows[0].errors[0]).toContain('no encontramos la columna Tiempo')
  })
})

describe('filas y numeración', () => {
  it('las filas vacías que deja Excel al final (",,,,," o ";;;;;") no aparecen', () => {
    expect(parse('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Tiempo\nRodriguez,Maria,F,05/03/2017,25m Crawl,25.30\n,,,,,\n,,,,,\n')).toHaveLength(1)
    expect(parse('Rodriguez;Maria;F;05/03/2017;25m Crawl;25.30\n;;;;;\n ; ; ; ; ; \n')).toHaveLength(1)
  })

  it('"Fila N" es la fila de la hoja: el encabezado es la 1 y las líneas en blanco cuentan', () => {
    const rows = parse('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Tiempo\nRodriguez,Maria,F,05/03/2017,25m Crawl,25.30\n\nPerez,Ana,F,05/03/2017,25m Crawl,xx')
    expect(rows.map((row) => row.rowIndex)).toEqual([2, 4])
    expect(parse('Rodriguez,Maria,F,05/03/2017,25m Crawl,25.30')[0].rowIndex).toBe(1)
  })

  it('lo que queda por corregir conserva el encabezado (si no, un archivo desordenado se leería mal)', () => {
    const rows = parse('Nombre,Apellido,Sexo,Fecha Nac.,Evento,Tiempo\nMaria,Rodriguez,F,05/03/2017,25m Crawl,25.30\nAna,Perez,F,05/03/2017,25m Crawl,xx')
    const pending = pendingText(rows)
    expect(pending).toBe('Nombre,Apellido,Sexo,Fecha Nac.,Evento,Tiempo\nAna,Perez,F,05/03/2017,25m Crawl,xx')
    const [again] = parse(pending)
    expect([again.lastName, again.firstName]).toEqual(['Perez', 'Ana'])
    expect(pendingText(rows.filter(ok))).toBe('')
  })
})

describe('codificación del archivo', () => {
  it('CSV real de Excel en ANSI (Windows-1252, ";", CRLF) con ñ y tildes: los nombres llegan bien', () => {
    const bytes = readFileSync(new URL('./testSupport/excel-ansi.csv', import.meta.url))
    expect(new TextDecoder('utf-8').decode(bytes)).toContain('\uFFFD') // así llegaba antes
    const rows = parse(decodeCsvBytes(bytes))
    expect(rows.map((row) => `${row.lastName}, ${row.firstName}`)).toEqual(['Muñoz, José', 'Pérez Núñez, María Ángela', 'Ibáñez, Sofía'])
    expect(rows.every(ok)).toBe(true)
  })

  it('UTF-8 (con o sin BOM) se lee tal cual; sin U+FFFD no hay relectura', () => {
    const utf8 = new TextEncoder().encode('\uFEFFApellido;Nombre\nMuñoz;José')
    expect(decodeCsvBytes(utf8)).toBe('Apellido;Nombre\nMuñoz;José')
    expect(decodeCsvBytes(new TextEncoder().encode('Ibáñez'))).toBe('Ibáñez')
  })
})
