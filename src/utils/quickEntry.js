import { calculateAge, categoryForAge } from './ageCalculator'
import { eventAllowsSex } from './eventEligibility'
import { formatTimeInput, validateTime } from './timeParser'

const SEPARATORS = ['\t', ',', ';', '|']
const HEADER_WORDS = ['apellido', 'nombre', 'sexo', 'fecha nac', 'evento', 'tiempo']

export function eventLabel(event) {
  return `${event.distance}m ${event.style}`
}

export function buildTemplateRows(events = [], referenceDate = '') {
  const first = events.find(event => event.active !== false)
  const year = Number(String(referenceDate).slice(0, 4)) || new Date().getFullYear()
  const sex = ['X', 'B'].includes(String(first?.sex).toUpperCase()) ? 'F' : String(first?.sex || 'F').toUpperCase()
  const sample = first
    ? ['Rodriguez', 'Maria', sex, `15/05/${year - Number(first.age_lo || 10)}`, eventLabel(first), '32.56']
    : ['Rodriguez', 'Maria', 'F', '15/05/2013', '25m Crawl', '32.56']
  return [['Apellido', 'Nombre', 'Sexo', 'Fecha Nac.', 'Evento', 'Tiempo'], sample]
}

export function detectSeparator(line = '') {
  return SEPARATORS.map(separator => ({ separator, count: splitDelimitedLine(line, separator).length }))
    .sort((a, b) => b.count - a.count)[0]?.separator || '|'
}

export function splitDelimitedLine(line, separator) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"' && line[index + 1] === '"' && quoted) { current += '"'; index++; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (character === separator && !quoted) { values.push(current.trim()); current = ''; continue }
    current += character
  }
  values.push(current.trim())
  return values
}

// Minúsculas, sin tildes, puntuación como espacio, espacios simples. "Fecha Nac." → "fecha nac".
export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[._\-/]/g, ' ').replace(/\s+/g, ' ').trim()
}

// v1.20.0: columnas en su orden de siempre (sin encabezado, o encabezado en ese orden).
export const FIELDS = ['lastName', 'firstName', 'sex', 'birthDate', 'event', 'time']
export const FIELD_NAMES = { lastName: 'Apellido', firstName: 'Nombre', sex: 'Sexo', birthDate: 'Fecha Nac.', event: 'Evento', time: 'Tiempo' }
const HEADER_SYNONYMS = [
  ['lastName', (cell) => cell.includes('apellido')],
  ['firstName', (cell) => cell.includes('nombre')],
  ['sex', (cell) => cell.includes('sexo') || cell.includes('genero')],
  ['birthDate', (cell) => cell.includes('nac') || cell.startsWith('fecha')],
  ['event', (cell) => cell.includes('evento') || cell.includes('prueba')],
  ['time', (cell) => cell.includes('tiempo') || cell.includes('marca')]
]

// Encabezado → índice de cada campo por su nombre (tildes, mayúsculas y sinónimos da igual).
// Un campo que no aparece queda sin índice.
export function headerColumns(values) {
  const columns = {}
  values.forEach((value, index) => {
    const cell = normalizeText(value)
    const field = HEADER_SYNONYMS.find(([name, matches]) => columns[name] === undefined && matches(cell))?.[0]
    if (field) columns[field] = index
  })
  return columns
}

export function isHeaderRow(values) {
  const normalized = values.map(value => value.toLowerCase().replace(/[._-]/g, ' ').trim())
  const legacy = HEADER_WORDS.filter(word => normalized.some(value => value.includes(word))).length >= 4
  return legacy || Object.keys(headerColumns(values)).length >= 4
}

const DEFAULT_COLUMNS = Object.fromEntries(FIELDS.map((field, index) => [field, index]))

// Con encabezado completo se lee por nombre (el orden de las columnas da igual). Incompleto
// pero con lo que sí reconoce en su lugar de siempre, por posición (como hasta v1.19.2).
// Incompleto y desordenado: no se adivina, se dice qué columna falta.
export function resolveColumns(headerValues) {
  const found = headerColumns(headerValues)
  const missing = FIELDS.filter(field => found[field] === undefined)
  if (!missing.length) return { columns: found }
  if (Object.entries(found).every(([field, index]) => DEFAULT_COLUMNS[field] === index)) return { columns: DEFAULT_COLUMNS }
  return { missing }
}

// v1.20.0: Excel en Windows (español) guarda "CSV (delimitado por comas)" en ANSI
// (Windows-1252). Leído como UTF-8, "Muñoz" llega como "Mu�oz" y se guardaría así. Solo si
// aparece el carácter de reemplazo (U+FFFD) se vuelve a leer como Windows-1252.
export function decodeCsvBytes(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8
  return text.replace(/^﻿/, '')
}

export function normalizeBirthDate(value = '') {
  const clean = value.trim()
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : ''
}

// v1.20.0: rowIndex es el número de fila de la hoja (el encabezado es la fila 1), para que
// "Fila 7" sea la fila 7 de Excel. headerLine viaja con cada fila: si quedan filas por
// corregir, se devuelven con su encabezado (sin él, un archivo desordenado se leería mal).
export function parseQuickEntry(text, { referenceDate, events = [] }) {
  const sourceLines = text.replace(/^﻿/, '').split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith('#'))
  if (!sourceLines.length) return []
  const separator = detectSeparator(sourceLines[0].line)
  const firstValues = splitDelimitedLine(sourceLines[0].line, separator)
  const header = isHeaderRow(firstValues)
  const headerLine = header ? sourceLines[0].line : null
  const { columns, missing } = header ? resolveColumns(firstValues) : { columns: DEFAULT_COLUMNS }
  if (missing) {
    const names = missing.map(field => FIELD_NAMES[field]).join(', ')
    return [{ rowIndex: sourceLines[0].lineNumber, rawLine: sourceLines[0].line, headerLine: null, lastName: '', firstName: '', label: '', errors: [`En el encabezado no encontramos la columna ${names}. Agrégala (o pon las columnas en el orden Apellido, Nombre, Sexo, Fecha Nac., Evento, Tiempo) y vuelve a cargar el archivo.`], warnings: [] }]
  }
  return sourceLines.slice(header ? 1 : 0).map(({ line: rawLine, lineNumber }) => {
    const values = splitDelimitedLine(rawLine, separator)
    // Filas que Excel deja al final con solo separadores (",,,,,"): no son datos.
    if (values.every(value => !value)) return null
    const [lastName, firstName, sexRaw, dateRaw, labelRaw, rawTime] = FIELDS.map(field => values[columns[field]])
    const sex = sexRaw?.toUpperCase()
    const birthDate = normalizeBirthDate(dateRaw)
    const age = calculateAge(birthDate, referenceDate)
    const ranges = [...new Map(events.map(event => [`${event.age_lo}-${event.age_hi}`, [event.age_lo, event.age_hi]])).values()]
    const category = categoryForAge(age, ranges)
    const wantedLabel = labelRaw?.trim() || ''
    const eligible = events.filter(event => event.active !== false && eventAllowsSex(event.sex, sex) && age >= Number(event.age_lo) && age <= Number(event.age_hi))
    const candidate = eligible.find(event => eventLabel(event).toLowerCase() === wantedLabel.toLowerCase())
    const time = formatTimeInput(rawTime || '')
    const errors = []
    const warnings = []
    if (!lastName || !firstName) errors.push('Faltan nombre o apellido')
    if (!['F', 'M'].includes(sex)) errors.push('El sexo debe ser F o M')
    if (!birthDate || age == null || !category) errors.push('Fecha o edad inválida')
    if (!candidate) {
      const available = [...new Set(eligible.map(eventLabel))]
      errors.push(available.length
        ? `Evento no encontrado. Eventos disponibles para ${sex || 'este sexo'}, ${age ?? '?'} años: ${available.join(', ')}`
        : 'Evento no encontrado para la edad y sexo indicados')
    }
    const timeError = validateTime(time)
    if (timeError) (rawTime && /\.\d$/.test(rawTime.trim()) ? warnings : errors).push(timeError)
    return { rowIndex: lineNumber, rawLine, headerLine, lastName, firstName, sex, birthDate, age, category, eventIndex: candidate?.event_ptr, label: candidate ? eventLabel(candidate) : wantedLabel, time, errors, warnings }
  }).filter(Boolean)
}

// Lo que queda en el cuadro tras importar: las filas por corregir, con su encabezado.
export function pendingText(rows = []) {
  const pending = rows.filter(row => row.errors.length || row.warnings.length)
  if (!pending.length) return ''
  const header = pending.find(row => row.headerLine)?.headerLine
  return [...(header ? [header] : []), ...pending.map(row => row.rawLine)].join('\n')
}

// Filas válidas → nadadores nuevos para el roster (lo que se guarda). Un nadador por
// apellido+nombre+fecha+sexo, un evento una sola vez; se omiten los que ya están en el roster.
export function importAdditions(validRows, roster = [], newId = () => crypto.randomUUID()) {
  const grouped = new Map()
  validRows.forEach(row => {
    const key = `${row.lastName}|${row.firstName}|${row.birthDate}|${row.sex}`.toLowerCase()
    if (!grouped.has(key)) grouped.set(key, { id: newId(), lastName: row.lastName, firstName: row.firstName, sex: row.sex, birthDate: row.birthDate, age: row.age, category: row.category, events: [] })
    const athlete = grouped.get(key)
    if (!athlete.events.some(entry => entry.eventIndex === row.eventIndex)) athlete.events.push({ eventIndex: row.eventIndex, label: row.label, time: row.time })
  })
  return [...grouped.values()].filter(item => !roster.some(old => `${old.firstName} ${old.lastName}`.toLowerCase() === `${item.firstName} ${item.lastName}`.toLowerCase()))
}

export function csvEscape(value) {
  const string = String(value ?? '')
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

export function downloadCsv(rows, filename) {
  const content = `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(value = 'club') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'club'
}
