import clubs from '../data/clubs.json'
import eventData from '../data/events.json'
import { DEMO_ADMIN_PASSWORD, DEMO_WHATSAPP, STORAGE_KEYS } from '../config'
import { standardEventTemplate } from '../utils/eventTemplate'
import { teamIdentity } from '../utils/teamUtils'
import { buildConsolidatedExport } from '../utils/mmSchema'

const LEGACY_EVENT_ID = 'evt_demo_2025'
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const tokenPrefix = name => name.slice(0, 3).toUpperCase().normalize('NFD').replace(/[^A-Z]/g, 'X')
const eventKey = id => `${STORAGE_KEYS.eventsPrefix}${id}`
const inscriptionKey = (eventId, clubCode) => `${eventId}:${clubCode}`

function legacyEvent() {
  return {
    id: LEGACY_EVENT_ID, name: eventData.event.name, date_start: eventData.event.date, date_end: null,
    venue: eventData.event.venue, reference_date: eventData.event.reference_date, deadline: null, notes: '',
    organizer: eventData.event.organizer, organizer_whatsapp: DEMO_WHATSAPP, contact: eventData.event.contact,
    status: 'active', created_at: new Date().toISOString(),
    clubs: clubs.map(teamIdentity), events: standardEventTemplate(), activated_at: new Date().toISOString(), closed_at: null
  }
}

export function ensureDemoData() {
  let ids = read(STORAGE_KEYS.eventsList, [])
  if (!ids.length) { const event = legacyEvent(); ids = [event.id]; write(eventKey(event.id), event); write(STORAGE_KEYS.eventsList, ids) }
  if (!localStorage.getItem(STORAGE_KEYS.clubsMaster)) write(STORAGE_KEYS.clubsMaster, clubs.map(teamIdentity))
  else write(STORAGE_KEYS.clubsMaster, read(STORAGE_KEYS.clubsMaster, []).map(teamIdentity))
  if (!localStorage.getItem(STORAGE_KEYS.eventsTemplate)) write(STORAGE_KEYS.eventsTemplate, standardEventTemplate())
  return ids
}

export function demoLogin(password) {
  if (password !== DEMO_ADMIN_PASSWORD) throw new Error('Contraseña incorrecta')
  return { token: `demo-admin-${Date.now()}` }
}

export function demoListEvents() {
  return ensureDemoData().map(id => demoGetEvent(id)).filter(Boolean).map(event => {
    const dashboard = demoDashboard(event.id)
    return { ...event, progress: { received: dashboard.counts.received, clubs: dashboard.counts.total_clubs, athletes: dashboard.counts.athletes } }
  })
}

export function demoGetEvent(id) { ensureDemoData(); const event = read(eventKey(id), null); return event ? { ...event, clubs: (event.clubs || []).map(teamIdentity) } : null }
export function demoGetMasterClubs() { ensureDemoData(); return read(STORAGE_KEYS.clubsMaster, []) }
export function demoAddMasterClub(club) {
  const master = demoGetMasterClubs()
  if (master.some(item => Number(item.code) === Number(club.code))) throw new Error('Ese código de club ya existe')
  write(STORAGE_KEYS.clubsMaster, [...master, club])
  return club
}

export function demoSaveEvent(input, activate = false) {
  ensureDemoData()
  const id = input.id || `evt_${crypto.randomUUID().slice(0, 8)}`
  const status = activate ? 'active' : (input.status || 'draft')
  const event = { ...input, id, clubs: input.clubs.map(teamIdentity), date_end: input.date_end || null, deadline: input.deadline || null, status, created_at: input.created_at || new Date().toISOString(), activated_at: status === 'active' ? (input.activated_at || new Date().toISOString()) : (input.activated_at || null), closed_at: input.closed_at || null, organizer_whatsapp: input.organizer_whatsapp || DEMO_WHATSAPP }
  write(eventKey(id), event)
  const ids = read(STORAGE_KEYS.eventsList, []); if (!ids.includes(id)) write(STORAGE_KEYS.eventsList, [...ids, id])
  const master = demoGetMasterClubs()
  event.clubs.forEach(club => { if (!master.some(item => Number(item.code) === Number(club.code))) master.push(club) })
  write(STORAGE_KEYS.clubsMaster, master)
  if (activate) demoGenerateTokens(id)
  return event
}

export function demoUpdateEventStatus(id, status) {
  const event = demoGetEvent(id); if (!event) throw new Error('Evento no encontrado')
  const saved = demoSaveEvent({ ...event, status, activated_at: status === 'active' ? (event.activated_at || new Date().toISOString()) : event.activated_at, closed_at: ['accepting_late','closed'].includes(status) ? new Date().toISOString() : event.closed_at }, false)
  if (status === 'active') demoGenerateTokens(id)
  return saved
}

export function demoCloneEvent(id) {
  const source = demoGetEvent(id); if (!source) throw new Error('Evento no encontrado')
  return { ...source, id: '', name: '', date_start: '', date_end: null, reference_date: '', deadline: null, venue: '', notes: '', status: 'draft', created_at: '' }
}

export function demoGenerateTokens(eventId = LEGACY_EVENT_ID) {
  const event = demoGetEvent(eventId) || legacyEvent()
  const current = read(STORAGE_KEYS.tokens, [])
  const expires = new Date(); expires.setDate(expires.getDate() + 60)
  const otherTokens = current.filter(item => (item.eventId || LEGACY_EVENT_ID) !== event.id)
  const eventTokens = event.clubs.map(club => current.find(item => (item.eventId || LEGACY_EVENT_ID) === event.id && Number(item.club.code) === Number(club.code)) || {
    id: `${club.abbreviation || tokenPrefix(club.name)}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8)}`, eventId: event.id,
    club, event, used: false, created_at: new Date().toISOString(), expires_at: expires.toISOString()
  })
  write(STORAGE_KEYS.tokens, [...otherTokens, ...eventTokens])
  return { success: true, tokens: eventTokens }
}

export function demoValidateToken(token) {
  ensureDemoData()
  const record = read(STORAGE_KEYS.tokens, []).find(item => item.id === token)
  if (!record || new Date(record.expires_at) < new Date()) return { valid: false }
  const eventId = record.eventId || LEGACY_EVENT_ID
  const event = demoGetEvent(eventId) || record.event
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = inscriptions[inscriptionKey(eventId, record.club.code)] || (eventId === LEGACY_EVENT_ID ? inscriptions[record.club.code] : null) || null
  const late = read(STORAGE_KEYS.lateInscriptions, {})[inscriptionKey(eventId, record.club.code)] || null
  return { valid: true, event: { ...event, date: event.date_start }, club: teamIdentity(record.club), eventId, already_submitted: event.status === 'accepting_late' ? Boolean(late) : Boolean(inscription), inscription: event.status === 'accepting_late' ? late : inscription, normal_inscription: inscription, whatsapp: event.organizer_whatsapp || DEMO_WHATSAPP }
}

export function demoSubmitInscription(payload) {
  const access = demoValidateToken(payload.token)
  if (!access.valid) throw new Error('El enlace no es válido o caducó')
  if (['draft','closed','archived'].includes(access.event.status)) throw new Error('Las inscripciones para este evento están cerradas')
  if (access.event.status === 'accepting_late') {
    const late = read(STORAGE_KEYS.lateInscriptions, {})
    late[inscriptionKey(access.eventId, access.club.code)] = { meta: payload.meta, athletes: payload.athletes, results: payload.results, roster: payload.roster, submitted_at: new Date().toISOString(), token: payload.token, eventId: access.eventId, club: access.club, status: 'pending', approved_athletes: [], rejected_athletes: [] }
    write(STORAGE_KEYS.lateInscriptions, late)
    return { success: true, late: true, summary: { athletes: payload.athletes.length, inscriptions: payload.results.length } }
  }
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = { meta: payload.meta, athletes: payload.athletes, results: payload.results, roster: payload.roster, submitted_at: new Date().toISOString(), token: payload.token, eventId: access.eventId }
  inscriptions[inscriptionKey(access.eventId, access.club.code)] = inscription
  write(STORAGE_KEYS.inscriptions, inscriptions)
  const tokens = read(STORAGE_KEYS.tokens, []).map(item => item.id === payload.token ? { ...item, used: true, submitted_at: inscription.submitted_at } : item)
  write(STORAGE_KEYS.tokens, tokens)
  return { success: true, summary: { athletes: payload.athletes.length, inscriptions: payload.results.length } }
}

export function demoDashboard(eventId = LEGACY_EVENT_ID) {
  const event = demoGetEvent(eventId) || legacyEvent()
  const tokens = read(STORAGE_KEYS.tokens, [])
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const lateMap = read(STORAGE_KEYS.lateInscriptions, {})
  const clubRows = event.clubs.map(club => {
    const token = tokens.find(item => (item.eventId || LEGACY_EVENT_ID) === event.id && Number(item.club.code) === Number(club.code))
    const inscription = inscriptions[inscriptionKey(event.id, club.code)] || (event.id === LEGACY_EVENT_ID ? inscriptions[club.code] : null)
    return { ...club, status: inscription ? 'received' : token ? 'sent' : 'missing', athlete_count: inscription?.athletes?.length || 0, submitted_at: inscription?.submitted_at || null, token: token?.id || null, expires_at: token?.expires_at || null }
  })
  const late = Object.entries(lateMap).filter(([key]) => key.startsWith(`${eventId}:`)).map(([, value]) => value)
  const submittedDates = clubRows.map(club => club.submitted_at).filter(Boolean).sort()
  return { event, clubs: clubRows, late, counts: { total_clubs: clubRows.length, received: clubRows.filter(item => item.status === 'received').length, pending: clubRows.filter(item => item.status !== 'received').length, athletes: clubRows.reduce((sum, item) => sum + item.athlete_count, 0), late_pending: late.filter(item => ['pending','partially_approved'].includes(item.status)).length }, timestamps: { opened_at: event.activated_at || event.created_at || null, last_submission_at: submittedDates.at(-1) || null, closed_at: event.closed_at || null } }
}

export function demoGetInscription(eventId, clubCode) {
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = inscriptions[inscriptionKey(eventId, clubCode)] || (eventId === LEGACY_EVENT_ID ? inscriptions[clubCode] : null)
  if (!inscription) throw new Error('Inscripción no encontrada')
  return inscription
}

export function demoReviewLate(eventId, clubCode, action, athleteIds = []) {
  const all = read(STORAGE_KEYS.lateInscriptions, {})
  const key = inscriptionKey(eventId, clubCode); const item = all[key]
  if (!item) throw new Error('Inscripción tardía no encontrada')
  const ids = action === 'approve_all' ? item.athletes.map(athlete => athlete.Ath_no) : athleteIds.map(Number)
  const approved = new Set(item.approved_athletes || []); const rejected = new Set(item.rejected_athletes || [])
  ids.forEach(id => { if (action.startsWith('approve')) { approved.add(id); rejected.delete(id) } else { rejected.add(id); approved.delete(id) } })
  const decided = approved.size + rejected.size
  item.approved_athletes = [...approved]; item.rejected_athletes = [...rejected]
  item.status = approved.size === item.athletes.length ? 'approved' : rejected.size === item.athletes.length ? 'rejected' : decided ? 'partially_approved' : 'pending'
  all[key] = item; write(STORAGE_KEYS.lateInscriptions, all); return item
}

export async function demoExportAll(eventId = LEGACY_EVENT_ID, type = 'principal') {
  const prefix = `${eventId}:`; const all = read(STORAGE_KEYS.inscriptions, {})
  const inscriptions = Object.entries(all).filter(([key]) => key.startsWith(prefix) || (eventId === LEGACY_EVENT_ID && !key.includes(':'))).map(([, value]) => value)
  const late = Object.entries(read(STORAGE_KEYS.lateInscriptions, {})).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value)
  return buildConsolidatedExport({ event: demoGetEvent(eventId) || legacyEvent(), inscriptions, lateInscriptions: late, type })
}
