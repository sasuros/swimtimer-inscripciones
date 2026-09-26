import { calculateAge, categoryForAge } from './ageCalculator'
import { eventAllowsSex } from './eventEligibility'
import { NO_TIME, formatTimeInput, validateTime } from './timeParser'

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
// (Windows-1252). Leído como UTF-8, "Muñoz" llega con el carácter de reemplazo (U+FFFD) y se guardaría así. Solo si
// aparece el carácter de reemplazo (U+FFFD) se vuelve a leer como Windows-1252.
export function decodeCsvBytes(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  const text = utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(buffer) : utf8
  return text.replace(/^\uFEFF/, '')
}

const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)
const pad = (number) => String(number).padStart(2, '0')
const realDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
const DATE_HELP = 'Escríbela como DD/MM/AAAA, por ejemplo 05/03/2017.'

// v1.20.0: fecha de nacimiento → { date: 'AAAA-MM-DD' } o { error } (nunca se adivina).
// D/M/AAAA con / - o . es día/mes (el formato documentado, igual que 05/03/2017 hasta hoy).
export function parseBirthDate(raw = '') {
  const value = String(raw ?? '').trim()
  if (!value) return { error: `Falta la fecha de nacimiento. ${DATE_HELP}` }
  let year, month, day
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const dayFirst = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d+)$/)
  if (iso) [year, month, day] = iso.slice(1).map(Number)
  else if (dayFirst) {
    ;[day, month, year] = dayFirst.slice(1).map(Number)
    if (dayFirst[3].length !== 4) return { error: `En la fecha "${value}" el año tiene que ir completo, con 4 cifras. ${DATE_HELP}` }
    if (month > 12) {
      return day <= 12 && month <= 31
        ? { error: `La fecha "${value}" parece estar como mes/día. Escríbela como día/mes/año: ${pad(month)}/${pad(day)}/${year}.` }
        : { error: `La fecha "${value}" no existe. ${DATE_HELP}` }
    }
  } else if (/^\d{5}$/.test(value)) {
    // Número de serie de Excel: no se convierte (Excel usa dos sistemas de fechas, 1900 y 1904).
    return { error: `Excel convirtió la fecha en un número (${value}). Pon esa columna en formato Fecha, o ${DATE_HELP.charAt(0).toLowerCase()}${DATE_HELP.slice(1)}` }
  } else return { error: `La fecha "${value}" no se entiende. ${DATE_HELP}` }
  if (!realDate(year, month, day)) return { error: `La fecha "${value}" no existe. ${DATE_HELP}` }
  return { date: `${year}-${pad(month)}-${pad(day)}` }
}

export function normalizeBirthDate(value = '') {
  return parseBirthDate(value).date || ''
}

// v1.20.0: sexo, solo sinónimos inequívocos. Cualquier otra cosa → null (se rechaza).
const SEX_SYNONYMS = { F: ['f', 'femenino', 'mujer'], M: ['m', 'masculino', 'hombre', 'h'] }
export function normalizeSex(value = '') {
  const clean = normalizeText(value)
  return Object.keys(SEX_SYNONYMS).find(sex => SEX_SYNONYMS[sex].includes(clean)) || null
}

// v1.20.0: tiempo. NT / N/T / S/T / "sin tiempo" → 00.00 (el NT del sistema); coma decimal →
// punto. Lo demás pasa tal cual a formatTimeInput (el mismo de siempre).
const NO_TIME_WORDS = ['nt', 'n t', 's t', 'sin tiempo']
export function normalizeCsvTime(raw = '') {
  const value = String(raw ?? '').trim()
  if (NO_TIME_WORDS.includes(normalizeText(value))) return NO_TIME
  if (/^\d{1,2}(:\d{2})?,\d{1,2}$/.test(value)) return value.replace(',', '.')
  return value
}

// v1.20.0: estilo → clave canónica. Solo sinónimos inequívocos; lo demás se compara tal cual
// (sin tildes ni mayúsculas), p. ej. "Tablita".
const STYLE_SYNONYMS = [
  ['crawl', ['crawl', 'libre', 'free', 'freestyle']],
  ['espalda', ['espalda', 'dorso', 'back', 'backstroke']],
  ['pecho', ['pecho', 'braza', 'breast', 'breaststroke']],
  ['mariposa', ['mariposa', 'fly', 'butterfly']],
  ['comb', ['comb individual', 'combinado', 'combinado individual', 'ci', 'im']]
]
export function styleKey(style = '') {
  const clean = normalizeText(style).replace(/^estilo /, '')
  return STYLE_SYNONYMS.find(([, words]) => words.includes(clean))?.[0] || clean
}

const eventKey = (event) => `${Number(event.distance)}|${styleKey(event.style)}`

// "25 Crawl", "25m crawl", "25 mts Crawl", "25 metros Libre", "25m Estilo Libre" → '25|crawl'.
export function eventTextKey(value = '') {
  const match = normalizeText(value).match(/^(\d+)\s*(?:metros|metro|mts|mt|m)?\s+(.+)$/)
  return match ? `${Number(match[1])}|${styleKey(match[2])}` : null
}

// v1.20.0: rowIndex es el número de fila de la hoja (el encabezado es la fila 1), para que
// "Fila 7" sea la fila 7 de Excel. headerLine viaja con cada fila: si quedan filas por
// corregir, se devuelven con su encabezado (sin él, un archivo desordenado se leería mal).
export function parseQuickEntry(text, { referenceDate, events = [] }) {
  const sourceLines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
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
    const [lastName, firstName, sexRaw = '', dateRaw, labelRaw, rawTime = ''] = FIELDS.map(field => values[columns[field]])
    const errors = []
    const warnings = []
    // Una causa, un error: si falla el sexo o la fecha, no se suma "evento no encontrado".
    if (!lastName) errors.push('Falta el apellido.')
    if (!firstName) errors.push('Falta el nombre.')
    if ([lastName, firstName].some(value => value?.includes(REPLACEMENT_CHAR))) errors.push(`El nombre tiene caracteres que no se leen (${REPLACEMENT_CHAR}). Guarda el archivo como "CSV UTF-8" y vuelve a cargarlo.`)
    const sex = normalizeSex(sexRaw) || sexRaw.toUpperCase()
    if (!normalizeSex(sexRaw)) errors.push(sexRaw ? `El sexo "${sexRaw}" no se entiende. Escribe F (femenino) o M (masculino).` : 'Falta el sexo. Escribe F o M.')
    const parsedDate = parseBirthDate(dateRaw)
    const birthDate = parsedDate.date || ''
    const age = calculateAge(birthDate, referenceDate)
    const ranges = [...new Map(events.map(event => [`${event.age_lo}-${event.age_hi}`, [event.age_lo, event.age_hi]])).values()]
    const category = categoryForAge(age, ranges)
    if (parsedDate.error) errors.push(parsedDate.error)
    else if (age == null) errors.push(`No pudimos calcular la edad con la fecha "${dateRaw}". Revísala.`)
    else if (!category) errors.push(`Con esa fecha tendría ${age} años y no entra en ninguna categoría de este torneo (${ranges.map(([lo, hi]) => `${lo}-${hi}`).join(', ')}). Revisa la fecha.`)
    const wantedLabel = labelRaw?.trim() || ''
    const eligible = events.filter(event => event.active !== false && eventAllowsSex(event.sex, sex) && age >= Number(event.age_lo) && age <= Number(event.age_hi))
    // Primero el nombre exacto (como hasta v1.19.2); si no, por distancia + estilo con sinónimos.
    let candidate = eligible.find(event => eventLabel(event).toLowerCase() === wantedLabel.toLowerCase())
    let eventError = ''
    const available = [...new Set(eligible.map(eventLabel))]
    const who = `${sex} de ${age} años`
    if (!candidate && normalizeSex(sexRaw) && category) {
      const key = eventTextKey(wantedLabel)
      const sameKey = key ? events.filter(event => event.active !== false && eventKey(event) === key) : []
      const labels = [...new Set(sameKey.map(eventLabel))]
      if (!wantedLabel) eventError = `Falta el evento. Escribe, por ejemplo, ${available[0] || '25m Crawl'}.`
      else if (labels.length > 1) eventError = `"${wantedLabel}" coincide con más de un evento (${labels.join(', ')}). Escribe el nombre exacto.`
      else if (!labels.length) eventError = `El evento "${wantedLabel}" no existe en este torneo. ${available.length ? `Para ${who} puedes usar: ${available.join(', ')}.` : `No hay eventos para ${who}.`}`
      else {
        candidate = eligible.find(event => eventKey(event) === key)
        if (!candidate) eventError = `"${labels[0]}" no está disponible para ${who}. ${available.length ? `Puedes usar: ${available.join(', ')}.` : ''}`.trim()
      }
    }
    if (eventError) errors.push(eventError)
    // Coma decimal con el archivo separado por comas: "25,30" llega partido en dos columnas.
    const nextValue = values[columns.time + 1]
    const splitByComma = separator === ',' && /^\d{1,2}(:\d{2})?$/.test(rawTime.trim()) && /^\d{1,2}$/.test(nextValue || '')
    const time = splitByComma ? rawTime.trim() : formatTimeInput(normalizeCsvTime(rawTime))
    if (splitByComma) errors.push(`El tiempo tiene coma decimal y el archivo separa las columnas con comas. Escribe ${rawTime.trim()}.${nextValue} con punto, o guarda el archivo con punto y coma (;).`)
    else if (!rawTime.trim()) errors.push('Escribe el tiempo, o NT si no tiene.')
    else {
      const timeError = validateTime(time)
      if (timeError && /\.\d$/.test(time)) warnings.push(timeError)
      else if (timeError && /centésimas|segundos/.test(timeError)) errors.push(timeError)
      else if (timeError) errors.push(`El tiempo "${rawTime.trim()}" no se entiende. Escríbelo como 25.30 o 1:25.30, o NT si no tiene.`)
    }
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
