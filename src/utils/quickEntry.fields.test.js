import { describe, expect, it } from 'vitest'
import { parseQuickEntry } from './quickEntry'
import { standardEventTemplate } from './eventTemplate'

// v1.20.0 — campos tolerantes: variantes de escritura sí; inventar datos, nunca.
// Nadadora de 9 años (nacida en 2017) con la fecha de referencia del torneo.
const options = { referenceDate: '2026-10-17', events: standardEventTemplate() }
const base = { last: 'Rodriguez', first: 'Maria', sex: 'F', date: '05/03/2017', event: '25m Crawl', time: '25.30' }
const row = (patch = {}, separator = ';') => {
  const values = { ...base, ...patch }
  const [parsed] = parseQuickEntry(['Apellido', 'Nombre', 'Sexo', 'Fecha Nac.', 'Evento', 'Tiempo'].join(separator) + '\n' + [values.last, values.first, values.sex, values.date, values.event, values.time].join(separator), options)
  return parsed
}
const accepted = (parsed) => !parsed.errors.length && !parsed.warnings.length

describe('evento: distancia con o sin unidad y estilo por sinónimos', () => {
  it.each([
    ['25 Crawl', '25m Crawl'], ['25m crawl', '25m Crawl'], ['25 mts Crawl', '25m Crawl'], ['25 metros Libre', '25m Crawl'],
    ['25m Libre', '25m Crawl'], ['25m Free', '25m Crawl'], ['25m Estilo Libre', '25m Crawl'], ['25M LIBRE', '25m Crawl'],
    ['25m Dorso', '25m Espalda'], ['25m Back', '25m Espalda'], ['25m Braza', '25m Pecho'], ['25m Breast', '25m Pecho'],
    ['25m Fly', '25m Mariposa'], ['25m Mariposa', '25m Mariposa'], ['25m Mariposá', '25m Mariposa'], ['25 MTS. MARIPOSA', '25m Mariposa'],
    ['25m Tablita', '25m Tablita']
  ])('"%s" → %s', (event, label) => {
    const parsed = row({ event })
    expect(accepted(parsed)).toBe(true)
    expect(parsed.label).toBe(label)
  })

  it.each(['100m Combinado', '100m CI', '100m IM', '100 metros comb. individual'])('"%s" → 100m Comb. Individual', (event) => {
    const parsed = row({ event, date: '05/03/2014' })
    expect(accepted(parsed)).toBe(true)
    expect(parsed.label).toBe('100m Comb. Individual')
  })

  it('si dos eventos quedan iguales al normalizar, no se elige: se pide el nombre exacto', () => {
    const events = [...standardEventTemplate(), { event_ptr: 999, distance: 25, style: 'Libre', age_lo: 8, age_hi: 9, sex: 'F', active: true }]
    const [parsed] = parseQuickEntry('Rodriguez;Maria;F;05/03/2017;25 metros free;25.30', { ...options, events })
    expect(parsed.errors).toEqual(['"25 metros free" coincide con más de un evento (25m Crawl, 25m Libre). Escribe el nombre exacto.'])
    const [exact] = parseQuickEntry('Rodriguez;Maria;F;05/03/2017;25m Libre;25.30', { ...options, events })
    expect(exact).toMatchObject({ label: '25m Libre', eventIndex: 999, errors: [] })
  })

  it('un evento que no existe dice cuáles sí puede usar; uno que no es de su edad, también', () => {
    expect(row({ event: '200m Crawl' }).errors).toEqual(['El evento "200m Crawl" no existe en este torneo. Para F de 9 años puedes usar: 25m Crawl, 25m Espalda, 25m Pecho, 25m Mariposa, 25m Tablita, 50m Crawl.'])
    expect(row({ event: '100m Libre' }).errors[0]).toBe('"100m Crawl" no está disponible para F de 9 años. Puedes usar: 25m Crawl, 25m Espalda, 25m Pecho, 25m Mariposa, 25m Tablita, 50m Crawl.')
    expect(row({ event: '' }).errors).toEqual(['Falta el evento. Escribe, por ejemplo, 25m Crawl.'])
  })
})

describe('tiempo: coma decimal y NT', () => {
  it.each([['25,30', '25.30'], ['1:25,30', '1:25.30'], ['12530', '1:25.30'], ['NT', '00.00'], ['nt', '00.00'], ['S/T', '00.00'], ['N/T', '00.00'], ['sin tiempo', '00.00']])('"%s" → %s', (time, saved) => {
    const parsed = row({ time })
    expect(accepted(parsed)).toBe(true)
    expect(parsed.time).toBe(saved)
  })

  it('vacío sigue siendo error, con el mensaje aprobado', () => {
    expect(row({ time: '' }).errors).toEqual(['Escribe el tiempo, o NT si no tiene.'])
  })

  it('una sola cifra decimal sigue siendo aviso (con coma o con punto)', () => {
    expect(row({ time: '25,3' }).warnings[0]).toContain('centésimas')
    expect(row({ time: '25.3' }).warnings[0]).toContain('centésimas')
  })

  it('ilegible: qué escribir', () => {
    expect(row({ time: '25 seg' }).errors).toEqual(['El tiempo "25 seg" no se entiende. Escríbelo como 25.30 o 1:25.30, o NT si no tiene.'])
  })

  it('coma decimal en un archivo separado por comas: no se adivina, se explica', () => {
    const [parsed] = parseQuickEntry('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Tiempo\nRodriguez,Maria,F,05/03/2017,25m Crawl,25,30', options)
    expect(parsed.errors).toEqual(['El tiempo tiene coma decimal y el archivo separa las columnas con comas. Escribe 25.30 con punto, o guarda el archivo con punto y coma (;).'])
    const [quoted] = parseQuickEntry('Apellido,Nombre,Sexo,Fecha Nac.,Evento,Tiempo\nRodriguez,Maria,F,05/03/2017,25m Crawl,"25,30"', options)
    expect(quoted).toMatchObject({ time: '25.30', errors: [] })
  })
})

describe('fecha: formatos inequívocos; D/M es día/mes (formato documentado)', () => {
  it.each([['05/03/2017', '2017-03-05'], ['5/3/2017', '2017-03-05'], ['05-03-2017', '2017-03-05'], ['5.3.2017', '2017-03-05'], ['2017-03-05', '2017-03-05'], ['2017-3-5', '2017-03-05']])('"%s" → %s', (date, saved) => {
    const parsed = row({ date })
    expect(accepted(parsed)).toBe(true)
    expect(parsed.birthDate).toBe(saved)
  })

  it.each([
    ['42799', 'Excel convirtió la fecha en un número (42799). Pon esa columna en formato Fecha, o escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.'],
    ['05/03/17', 'En la fecha "05/03/17" el año tiene que ir completo, con 4 cifras. Escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.'],
    ['03/25/2017', 'La fecha "03/25/2017" parece estar como mes/día. Escríbela como día/mes/año: 25/03/2017.'],
    ['31/02/2017', 'La fecha "31/02/2017" no existe. Escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.'],
    ['marzo 2017', 'La fecha "marzo 2017" no se entiende. Escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.'],
    ['', 'Falta la fecha de nacimiento. Escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.']
  ])('"%s" se rechaza, sin "evento no encontrado" de más', (date, message) => {
    expect(row({ date }).errors).toEqual([message])
  })

  it('fecha válida pero fuera de las categorías del torneo', () => {
    expect(row({ date: '05/03/2000' }).errors).toEqual(['Con esa fecha tendría 26 años y no entra en ninguna categoría de este torneo (3-5, 6-7, 8-9, 10-11, 12-13, 14-15, 16-18). Revisa la fecha.'])
  })
})

describe('sexo: solo sinónimos inequívocos', () => {
  it.each([['F', 'F'], ['f', 'F'], ['Femenino', 'F'], ['FEMENINO', 'F'], ['Mujer', 'F'], ['M', 'M'], ['m', 'M'], ['Masculino', 'M'], ['H', 'M'], ['Hombre', 'M'], ['hombre', 'M']])('"%s" → %s', (sex, saved) => {
    const parsed = row({ sex })
    expect(accepted(parsed)).toBe(true)
    expect(parsed.sex).toBe(saved)
  })

  it.each(['X', 'V', 'Varón', 'Fem', 'Niña', 'FM'])('"%s" se rechaza con qué escribir', (sex) => {
    expect(row({ sex }).errors).toEqual([`El sexo "${sex}" no se entiende. Escribe F (femenino) o M (masculino).`])
  })

  it('vacío', () => {
    expect(row({ sex: '' }).errors).toEqual(['Falta el sexo. Escribe F o M.'])
  })
})

describe('nombres', () => {
  it('faltantes, cada uno con su mensaje', () => {
    expect(row({ last: '' }).errors).toEqual(['Falta el apellido.'])
    expect(row({ first: '' }).errors).toEqual(['Falta el nombre.'])
  })

  it('con caracteres ilegibles (pegado desde un archivo mal codificado) se rechaza', () => {
    const broken = `Mu${String.fromCharCode(0xfffd)}oz`
    expect(row({ last: broken }).errors[0]).toContain('Guarda el archivo como "CSV UTF-8"')
  })
})
