import { teamIdentity } from './teamUtils'

const hasNumber = value => value !== null && value !== '' && Number.isFinite(Number(value))
const COURSE_MAP = { '1': 'Y', '2': 'S', '3': 'L', S: 'S', L: 'L', Y: 'Y' }

export function normalizeMeetManagerSex(value) {
  const sex = String(value ?? '').trim().toUpperCase()
  if (['X', 'W', 'G', 'S'].includes(sex)) return 'F'
  if (sex === 'B') return 'X'
  if (sex === 'H') return 'M'
  return sex
}

export function parseMeetManagerConfig(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input
  if (!data || typeof data !== 'object') throw new Error('El archivo no contiene un objeto JSON válido')
  if (!data.meet?.name?.trim()) throw new Error('Falta el nombre del evento (meet.name)')
  if (!data.meet?.date_start) throw new Error('Falta la fecha de inicio (meet.date_start)')
  if (!Array.isArray(data.teams) || !data.teams.length) throw new Error('El archivo debe incluir al menos un equipo')
  if (!Array.isArray(data.events) || !data.events.length) throw new Error('El archivo debe incluir al menos una prueba')
  const clubs = data.teams.map(team => {
    if (!Number.isFinite(Number(team.code)) || !team.name?.trim()) throw new Error('Cada equipo debe tener código numérico y nombre')
    return teamIdentity(team)
  })
  const events = data.events.map((event, index) => {
    const eventPtr = Number(event.event_ptr)
    const distance = Number(event.distance)
    const style = String(event.style ?? '').trim()
    const ageLo = Number(event.age_lo)
    const ageHi = Number(event.age_hi)
    const originalSex = String(event.sex ?? '').trim()
    const valid = hasNumber(event.event_ptr) && hasNumber(event.distance) && distance > 0 && style
      && hasNumber(event.age_lo) && ageLo >= 0 && hasNumber(event.age_hi) && ageHi >= ageLo
      && originalSex
    if (!valid) throw new Error(`La prueba ${index + 1} tiene datos inválidos`)
    return { event_ptr: eventPtr, distance, style, age_lo: ageLo, age_hi: ageHi, sex: normalizeMeetManagerSex(originalSex), active: event.active !== false }
  })
  const rawCourse = String(data.meet.course ?? '').trim().toUpperCase()
  return {
    id: '', name: data.meet.name.trim(), date_start: data.meet.date_start, date_end: data.meet.date_end || null,
    venue: data.meet.venue || '', reference_date: data.meet.reference_date || data.meet.date_start, deadline: null,
    course: COURSE_MAP[rawCourse] || rawCourse || 'S', notes: '', organizer: 'Alberto Surós', organizer_whatsapp: '', contact: '',
    status: 'draft', clubs, events, imported_from: { source: data.source || 'Meet Manager', source_version: data.source_version || '', exported_at: data.exported_at || null }
  }
}

export function summarizeImportedEvents(events) {
  const groups = new Map()
  events.forEach(event => { const key = `${event.distance}m ${event.style}`; if (!groups.has(key)) groups.set(key, new Set()); groups.get(key).add(`${event.age_lo}-${event.age_hi}`) })
  return [...groups].map(([label, categories]) => ({ label, categories: categories.size }))
}
