import { teamIdentity } from './teamUtils'

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
    if (!Number.isFinite(Number(event.event_ptr)) || !Number.isFinite(Number(event.distance)) || !event.style || !['F', 'M'].includes(event.sex)) throw new Error(`La prueba ${index + 1} tiene datos inválidos`)
    return { event_ptr: Number(event.event_ptr), distance: Number(event.distance), style: String(event.style), age_lo: Number(event.age_lo), age_hi: Number(event.age_hi), sex: event.sex, active: true }
  })
  return {
    id: '', name: data.meet.name.trim(), date_start: data.meet.date_start, date_end: data.meet.date_end || null,
    venue: data.meet.venue || '', reference_date: data.meet.reference_date || '', deadline: null,
    course: data.meet.course || 'S', notes: '', organizer: 'Alberto Surós', organizer_whatsapp: '', contact: '',
    status: 'draft', clubs, events, imported_from: { source: data.source || 'Meet Manager', source_version: data.source_version || '', exported_at: data.exported_at || null }
  }
}

export function summarizeImportedEvents(events) {
  const groups = new Map()
  events.forEach(event => { const key = `${event.distance}m ${event.style}`; if (!groups.has(key)) groups.set(key, new Set()); groups.get(key).add(`${event.age_lo}-${event.age_hi}`) })
  return [...groups].map(([label, categories]) => ({ label, categories: categories.size }))
}
