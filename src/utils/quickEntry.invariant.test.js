import { describe, expect, it } from 'vitest'
import { importAdditions, parseQuickEntry } from './quickEntry'
import { legacyImportAdditions, parseQuickEntry as legacyParse } from './testSupport/quickEntryLegacy'
import { standardEventTemplate } from './eventTemplate'

// v1.20.0 — INVARIANTE del CSV tolerante: para la misma entrada que hoy (v1.19.2) es válida,
// lo que se guarda es idéntico (campos de cada fila y nadadores que se agregan al roster).
// El parser congelado está en testSupport/quickEntryLegacy.js.
const referenceDate = '2026-10-17'
const events = [
  ...standardEventTemplate(),
  { event_ptr: 900, distance: 50, style: 'Mariposa', age_lo: 10, age_hi: 18, sex: 'X', active: true }
]
const roster = [{ firstName: 'Maria', lastName: 'Rodriguez' }]
const SAVED = ['lastName', 'firstName', 'sex', 'birthDate', 'age', 'category', 'eventIndex', 'label', 'time']
const HEADERS = ['Apellido', 'Nombre', 'Sexo', 'Fecha Nac.', 'Evento', 'Tiempo']
const TIMES = ['32.56', '1:35.40', '2530', '12530', '00.00', '0:45.10', '59.99']
const LAST = ['Pérez', 'Muñoz', 'Rodriguez', "O'Brien", 'De la Cruz', 'López, hijo']
const FIRST = ['Ana', 'José', 'Maria', 'Luis', 'Sofía', 'Carlos']

// Filas válidas hoy: una por evento del catálogo, con la edad justa de su categoría.
function validRows() {
  return events.filter((event) => event.active).map((event, index) => {
    const age = Number(event.age_lo)
    const day = String((index % 27) + 1).padStart(2, '0')
    const year = 2026 - age - 1
    const iso = index % 3 === 0
    const date = iso ? `${year}-06-${day}` : `${day}/06/${year}`
    const sex = event.sex === 'X' ? (index % 2 ? 'f' : 'M') : index % 4 === 0 ? event.sex.toLowerCase() : event.sex
    const label = `${event.distance}m ${event.style}`
    const eventText = index % 5 === 0 ? label.toUpperCase() : index % 5 === 1 ? label.toLowerCase() : label
    // Cada 7 filas repite nadador (varios eventos por nadador), como en un archivo real.
    const who = Math.floor(index / 7) % LAST.length
    return [LAST[who], FIRST[who], sex, date, eventText, TIMES[index % TIMES.length]]
  })
}

const cell = (value, separator) => (value.includes(separator) || value.includes('"') ? `"${value.replaceAll('"', '""')}"` : value)
function documents() {
  const docs = []
  for (const separator of ['\t', ',', ';', '|']) {
    for (const header of [true, false]) {
      for (const eol of ['\n', '\r\n']) {
        const rows = validRows().map((row, index) => [...row, ...(index % 6 === 0 ? ['nota extra'] : [])])
        // El primer renglón define el separador: con encabezado, el encabezado; si no, una fila normal.
        const lines = [...(header ? [HEADERS] : []), ...rows].map((row) => row.map((value) => cell(value, separator)).join(separator))
        lines.splice(header ? 2 : 1, 0, '# comentario que se ignora')
        lines.push('Rodriguez' + separator + 'Maria' + separator + 'F' + separator + '15/05/2016' + separator + '25m Crawl' + separator + '33.10')
        docs.push({ name: `sep=${JSON.stringify(separator)} encabezado=${header} eol=${JSON.stringify(eol)}`, text: lines.join(eol) + eol })
      }
    }
  }
  return docs
}

const pick = (row) => Object.fromEntries(SAVED.map((key) => [key, row[key]]))
const valid = (rows) => rows.filter((row) => !row.errors.length && !row.warnings.length)
const withoutId = (items) => items.map(({ id: _id, ...rest }) => rest)

describe('invariante: la entrada válida de hoy se guarda idéntica', () => {
  const docs = documents()

  it('el corpus es significativo: 16 documentos, todas sus filas válidas hoy', () => {
    expect(docs).toHaveLength(16)
    for (const { text } of docs) {
      const rows = legacyParse(text, { referenceDate, events })
      expect(rows.length).toBeGreaterThan(70)
      expect(valid(rows)).toHaveLength(rows.length)
    }
  })

  it.each(docs.map((doc) => [doc.name, doc.text]))('%s: mismas filas válidas, mismos campos guardados', (_name, text) => {
    const before = valid(legacyParse(text, { referenceDate, events }))
    const after = valid(parseQuickEntry(text, { referenceDate, events }))
    expect(after.map(pick)).toEqual(before.map(pick))
  })

  it.each(docs.map((doc) => [doc.name, doc.text]))('%s: mismos nadadores agregados al roster', (_name, text) => {
    const before = legacyImportAdditions(valid(legacyParse(text, { referenceDate, events })), roster)
    const after = importAdditions(valid(parseQuickEntry(text, { referenceDate, events })), roster, () => 'id')
    expect(withoutId(after)).toEqual(before)
    expect(after.length).toBeGreaterThan(3)
  })
})
