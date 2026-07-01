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

export function isHeaderRow(values) {
  const normalized = values.map(value => value.toLowerCase().replace(/[._-]/g, ' ').trim())
  return HEADER_WORDS.filter(word => normalized.some(value => value.includes(word))).length >= 4
}

export function normalizeBirthDate(value = '') {
  const clean = value.trim()
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : ''
}

export function parseQuickEntry(text, { referenceDate, events = [] }) {
  const sourceLines = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'))
  if (!sourceLines.length) return []
  const separator = detectSeparator(sourceLines[0])
  const header = isHeaderRow(splitDelimitedLine(sourceLines[0], separator))
  return sourceLines.slice(header ? 1 : 0).map((rawLine, index) => {
    const [lastName, firstName, sexRaw, dateRaw, labelRaw, rawTime] = splitDelimitedLine(rawLine, separator)
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
    return { rowIndex: index + 1, rawLine, lastName, firstName, sex, birthDate, age, category, eventIndex: candidate?.event_ptr, label: candidate ? eventLabel(candidate) : wantedLabel, time, errors, warnings }
  })
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
