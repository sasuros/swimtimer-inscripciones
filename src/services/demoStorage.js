import clubs from '../data/clubs.json'
import eventData from '../data/events.json'
import { DEMO_ADMIN_PASSWORD, DEMO_WHATSAPP, STORAGE_KEYS } from '../config'
import { standardEventTemplate } from '../utils/eventTemplate'
import { teamIdentity } from '../utils/teamUtils'
import { buildConsolidatedExport } from '../utils/mmSchema'
import { accessFromDemoToken, decodeDemoToken, encodeDemoToken } from '../utils/demoToken'
import { ensureClubPin, generateClubPin } from '../utils/clubPin'

const LEGACY_EVENT_ID = 'evt_demo_2025'
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const eventKey = (id) => `${STORAGE_KEYS.eventsPrefix}${id}`
const inscriptionKey = (eventId, clubCode) => `${eventId}:${clubCode}`
const participationKey = (eventId, clubCode) => `${eventId}:${clubCode}`

function legacyEvent() {
  return {
    id: LEGACY_EVENT_ID,
    name: eventData.event.name,
    date_start: eventData.event.date,
    date_end: null,
    venue: eventData.event.venue,
    reference_date: eventData.event.reference_date,
    deadline: null,
    notes: '',
    organizer: eventData.event.organizer,
    organizer_whatsapp: DEMO_WHATSAPP,
    contact: eventData.event.contact,
    status: 'active',
    created_at: new Date().toISOString(),
    clubs: clubs.map(teamIdentity).map(ensureClubPin),
    events: standardEventTemplate(),
    activated_at: new Date().toISOString(),
    closed_at: null
  }
}

export function ensureDemoData() {
  const firstVisit = localStorage.getItem(STORAGE_KEYS.eventsList) === null
  let ids = read(STORAGE_KEYS.eventsList, [])
  if (firstVisit) {
    const event = legacyEvent()
    ids = [event.id]
    write(eventKey(event.id), event)
    write(STORAGE_KEYS.eventsList, ids)
  }
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
  return ensureDemoData()
    .map((id) => demoGetEvent(id))
    .filter(Boolean)
    .map((event) => {
      const dashboard = demoDashboard(event.id)
      return {
        ...event,
        progress: {
          received: dashboard.counts.received,
          clubs: dashboard.counts.total_clubs,
          athletes: dashboard.counts.athletes
        }
      }
    })
}

export function demoGetEvent(id) {
  ensureDemoData()
  const event = read(eventKey(id), null)
  if (!event) return null
  const normalized = {
    ...event,
    clubs: (event.clubs || []).map(teamIdentity).map(ensureClubPin)
  }
  if (normalized.clubs.some((club, index) => club.pin !== event.clubs[index]?.pin)) write(eventKey(id), normalized)
  return normalized
}
export function demoGetMasterClubs() {
  ensureDemoData()
  return read(STORAGE_KEYS.clubsMaster, [])
}
export function demoAddMasterClub(club) {
  const master = demoGetMasterClubs()
  if (master.some((item) => Number(item.code) === Number(club.code))) throw new Error('Ese código de club ya existe')
  write(STORAGE_KEYS.clubsMaster, [...master, club])
  return club
}

export function demoSaveEvent(input, activate = false) {
  ensureDemoData()
  const id = input.id || `evt_${crypto.randomUUID().slice(0, 8)}`
  const status = activate ? 'active' : input.status || 'draft'
  const event = {
    ...input,
    id,
    clubs: input.clubs.map(teamIdentity).map(ensureClubPin),
    date_end: input.date_end || null,
    deadline: input.deadline || null,
    status,
    created_at: input.created_at || new Date().toISOString(),
    activated_at: status === 'active' ? input.activated_at || new Date().toISOString() : input.activated_at || null,
    closed_at: input.closed_at || null,
    organizer_whatsapp: input.organizer_whatsapp || DEMO_WHATSAPP
  }
  write(eventKey(id), event)
  const ids = read(STORAGE_KEYS.eventsList, [])
  if (!ids.includes(id)) write(STORAGE_KEYS.eventsList, [...ids, id])
  const master = demoGetMasterClubs()
  event.clubs.forEach((club) => {
    if (!master.some((item) => Number(item.code) === Number(club.code))) master.push(club)
  })
  write(STORAGE_KEYS.clubsMaster, master)
  if (activate) demoGenerateTokens(id)
  return event
}

export function demoUpdateEventStatus(id, status) {
  const event = demoGetEvent(id)
  if (!event) throw new Error('Evento no encontrado')
  const saved = demoSaveEvent(
    {
      ...event,
      status,
      activated_at: status === 'active' ? event.activated_at || new Date().toISOString() : event.activated_at,
      closed_at: ['accepting_late', 'closed'].includes(status) ? new Date().toISOString() : event.closed_at
    },
    false
  )
  if (status === 'active') demoGenerateTokens(id)
  return saved
}

export function demoDeleteEvent(id) {
  const event = demoGetEvent(id)
  if (!event) throw new Error('Evento no encontrado')
  if (['active', 'accepting_late'].includes(event.status)) throw new Error('Cierra las inscripciones antes de eliminar el evento.')

  const belongsToEvent = (key) => key.startsWith(`${id}:`) || (id === LEGACY_EVENT_ID && !key.includes(':'))
  write(
    STORAGE_KEYS.eventsList,
    read(STORAGE_KEYS.eventsList, []).filter((eventId) => eventId !== id)
  )
  localStorage.removeItem(eventKey(id))
  write(
    STORAGE_KEYS.tokens,
    read(STORAGE_KEYS.tokens, []).filter((token) => (token.eventId || LEGACY_EVENT_ID) !== id)
  )
  write(STORAGE_KEYS.inscriptions, Object.fromEntries(Object.entries(read(STORAGE_KEYS.inscriptions, {})).filter(([key, value]) => !belongsToEvent(key) && value?.eventId !== id)))
  write(STORAGE_KEYS.lateInscriptions, Object.fromEntries(Object.entries(read(STORAGE_KEYS.lateInscriptions, {})).filter(([key, value]) => !key.startsWith(`${id}:`) && value?.eventId !== id)))
  write(STORAGE_KEYS.clubParticipation, Object.fromEntries(Object.entries(read(STORAGE_KEYS.clubParticipation, {})).filter(([key]) => !key.startsWith(`${id}:`))))
  return { success: true }
}

export function demoCloneEvent(id) {
  const source = demoGetEvent(id)
  if (!source) throw new Error('Evento no encontrado')
  return {
    ...source,
    id: '',
    name: '',
    date_start: '',
    date_end: null,
    reference_date: '',
    deadline: null,
    venue: '',
    notes: '',
    status: 'draft',
    created_at: ''
  }
}

export function demoGenerateTokens(eventId = LEGACY_EVENT_ID) {
  const event = demoGetEvent(eventId) || legacyEvent()
  const current = read(STORAGE_KEYS.tokens, [])
  const expires = new Date()
  expires.setDate(expires.getDate() + 60)
  const otherTokens = current.filter((item) => (item.eventId || LEGACY_EVENT_ID) !== event.id)
  const eventTokens = event.clubs.map((club) => ({
    id: encodeDemoToken(withoutPins(event), withoutPin(club)),
    eventId: event.id,
    club: withoutPin(club),
    event: withoutPins(event),
    used: false,
    created_at: new Date().toISOString(),
    expires_at: expires.toISOString()
  }))
  write(STORAGE_KEYS.tokens, [...otherTokens, ...eventTokens])
  return { success: true, tokens: eventTokens }
}

function withoutPin(club) {
  const { pin, ...safe } = club
  return safe
}
function withoutPins(event) {
  return { ...event, clubs: (event.clubs || []).map(withoutPin) }
}

export function demoValidateToken(token) {
  const embedded = decodeDemoToken(token)
  if (embedded) {
    const access = accessFromDemoToken(embedded)
    const record = read(STORAGE_KEYS.tokens, []).find((item) => item.id === token)
    if (!record)
      return {
        ...access,
        localMode: false,
        already_submitted: false,
        inscription: null,
        normal_inscription: null
      }
    const event = demoGetEvent(access.eventId) || access.event
    const inscriptions = read(STORAGE_KEYS.inscriptions, {})
    const inscription = inscriptions[inscriptionKey(access.eventId, access.club.code)] || null
    const late = read(STORAGE_KEYS.lateInscriptions, {})[inscriptionKey(access.eventId, access.club.code)] || null
    return {
      ...access,
      localMode: true,
      event: { ...withoutPins(event), date: event.date_start },
      already_submitted: event.status === 'accepting_late' ? Boolean(late) : Boolean(inscription),
      inscription: event.status === 'accepting_late' ? late : inscription,
      normal_inscription: inscription,
      whatsapp: event.organizer_whatsapp || access.whatsapp || DEMO_WHATSAPP
    }
  }
  ensureDemoData()
  const record = read(STORAGE_KEYS.tokens, []).find((item) => item.id === token)
  if (!record || new Date(record.expires_at) < new Date()) return { valid: false }
  const eventId = record.eventId || LEGACY_EVENT_ID
  const event = demoGetEvent(eventId) || record.event
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = inscriptions[inscriptionKey(eventId, record.club.code)] || (eventId === LEGACY_EVENT_ID ? inscriptions[record.club.code] : null) || null
  const late = read(STORAGE_KEYS.lateInscriptions, {})[inscriptionKey(eventId, record.club.code)] || null
  return {
    valid: true,
    localMode: true,
    event: { ...withoutPins(event), date: event.date_start },
    club: teamIdentity(record.club),
    eventId,
    already_submitted: event.status === 'accepting_late' ? Boolean(late) : Boolean(inscription),
    inscription: event.status === 'accepting_late' ? late : inscription,
    normal_inscription: inscription,
    whatsapp: event.organizer_whatsapp || DEMO_WHATSAPP
  }
}

export function demoSubmitInscription(payload) {
  const access = demoValidateToken(payload.token)
  if (!access.valid) throw new Error('El enlace no es válido o caducó')
  if (['draft', 'closed', 'archived'].includes(access.event.status)) throw new Error('Las inscripciones para este evento están cerradas')
  if (!access.localMode)
    return {
      success: true,
      external: true,
      late: access.event.status === 'accepting_late',
      summary: {
        athletes: payload.athletes.length,
        inscriptions: payload.results.length
      }
    }
  if (access.event.status === 'accepting_late') {
    const late = read(STORAGE_KEYS.lateInscriptions, {})
    late[inscriptionKey(access.eventId, access.club.code)] = {
      meta: payload.meta,
      athletes: payload.athletes,
      results: payload.results,
      roster: payload.roster,
      submitted_at: new Date().toISOString(),
      token: payload.token,
      eventId: access.eventId,
      club: access.club,
      status: 'pending',
      approved_athletes: [],
      rejected_athletes: []
    }
    write(STORAGE_KEYS.lateInscriptions, late)
    return {
      success: true,
      late: true,
      summary: {
        athletes: payload.athletes.length,
        inscriptions: payload.results.length
      }
    }
  }
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = {
    meta: payload.meta,
    athletes: payload.athletes,
    results: payload.results,
    roster: payload.roster,
    submitted_at: new Date().toISOString(),
    token: payload.token,
    eventId: access.eventId
  }
  inscriptions[inscriptionKey(access.eventId, access.club.code)] = inscription
  write(STORAGE_KEYS.inscriptions, inscriptions)
  const tokens = read(STORAGE_KEYS.tokens, []).map((item) => (item.id === payload.token ? { ...item, used: true, submitted_at: inscription.submitted_at } : item))
  write(STORAGE_KEYS.tokens, tokens)
  return {
    success: true,
    summary: {
      athletes: payload.athletes.length,
      inscriptions: payload.results.length
    }
  }
}

export function demoDashboard(eventId = LEGACY_EVENT_ID) {
  const event = demoGetEvent(eventId) || legacyEvent()
  const tokens = read(STORAGE_KEYS.tokens, [])
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const lateMap = read(STORAGE_KEYS.lateInscriptions, {})
  const participation = read(STORAGE_KEYS.clubParticipation, {})
  const clubRows = event.clubs.map((club) => {
    const token = tokens.find((item) => (item.eventId || LEGACY_EVENT_ID) === event.id && Number(item.club.code) === Number(club.code))
    const inscription = inscriptions[inscriptionKey(event.id, club.code)] || (event.id === LEGACY_EVENT_ID ? inscriptions[club.code] : null)
    const participating = participation[participationKey(event.id, club.code)] !== false
    return {
      ...club,
      status: participating ? (inscription ? 'received' : token ? 'sent' : 'missing') : 'not_participating',
      athlete_count: participating ? inscription?.athletes?.length || 0 : 0,
      inscription_count: participating ? inscription?.results?.length || 0 : 0,
      submitted_at: participating ? inscription?.submitted_at || null : null,
      token: token?.id || null,
      expires_at: token?.expires_at || null
    }
  })
  const late = Object.entries(lateMap)
    .filter(([key]) => key.startsWith(`${eventId}:`))
    .map(([, value]) => value)
  const submittedDates = clubRows
    .map((club) => club.submitted_at)
    .filter(Boolean)
    .sort()
  return {
    event,
    clubs: clubRows,
    late,
    counts: {
      total_clubs: clubRows.length,
      received: clubRows.filter((item) => item.status === 'received').length,
      pending: clubRows.filter((item) => !['received', 'not_participating'].includes(item.status)).length,
      athletes: clubRows.reduce((sum, item) => sum + item.athlete_count, 0),
      late_pending: late.filter((item) => ['pending', 'partially_approved'].includes(item.status)).length
    },
    timestamps: {
      opened_at: event.activated_at || event.created_at || null,
      last_submission_at: submittedDates.at(-1) || null,
      closed_at: event.closed_at || null
    }
  }
}

export function demoSetClubParticipation(eventId, clubCode, participates) {
  const event = demoGetEvent(eventId)
  if (!event?.clubs.some((club) => Number(club.code) === Number(clubCode))) throw new Error('Club no encontrado')
  const participation = read(STORAGE_KEYS.clubParticipation, {})
  participation[participationKey(eventId, clubCode)] = Boolean(participates)
  write(STORAGE_KEYS.clubParticipation, participation)
  return { success: true }
}

export function demoUpdateClubPin(eventId, clubCode) {
  const event = demoGetEvent(eventId)
  if (!event) throw new Error('Evento no encontrado')
  const pin = generateClubPin()
  demoSaveEvent({
    ...event,
    clubs: event.clubs.map((club) => (Number(club.code) === Number(clubCode) ? { ...club, pin } : club))
  })
  return { pin }
}

export function demoVerifyAccessPin(token, pin) {
  const record = read(STORAGE_KEYS.tokens, []).find((item) => item.id === token)
  return {
    valid: Boolean(record?.token_type === 'v3' && record.club?.pin === String(pin))
  }
}

export function demoGetInscription(eventId, clubCode) {
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = inscriptions[inscriptionKey(eventId, clubCode)] || (eventId === LEGACY_EVENT_ID ? inscriptions[clubCode] : null)
  if (!inscription) throw new Error('Inscripción no encontrada')
  return inscription
}

export function demoReviewLate(eventId, clubCode, action, athleteIds = []) {
  const all = read(STORAGE_KEYS.lateInscriptions, {})
  const key = inscriptionKey(eventId, clubCode)
  const item = all[key]
  if (!item) throw new Error('Inscripción tardía no encontrada')
  const ids = action === 'approve_all' ? item.athletes.map((athlete) => athlete.Ath_no) : athleteIds.map(Number)
  const approved = new Set(item.approved_athletes || [])
  const rejected = new Set(item.rejected_athletes || [])
  ids.forEach((id) => {
    if (action.startsWith('approve')) {
      approved.add(id)
      rejected.delete(id)
    } else {
      rejected.add(id)
      approved.delete(id)
    }
  })
  const decided = approved.size + rejected.size
  item.approved_athletes = [...approved]
  item.rejected_athletes = [...rejected]
  item.status = approved.size === item.athletes.length ? 'approved' : rejected.size === item.athletes.length ? 'rejected' : decided ? 'partially_approved' : 'pending'
  all[key] = item
  write(STORAGE_KEYS.lateInscriptions, all)
  return item
}

export async function demoExportAll(eventId = LEGACY_EVENT_ID, type = 'principal') {
  const prefix = `${eventId}:`
  const all = read(STORAGE_KEYS.inscriptions, {})
  const excluded = new Set(
    Object.entries(read(STORAGE_KEYS.clubParticipation, {}))
      .filter(([key, participates]) => key.startsWith(prefix) && participates === false)
      .map(([key]) => Number(key.slice(prefix.length)))
  )
  const inscriptions = Object.entries(all)
    .filter(([key]) => key.startsWith(prefix) || (eventId === LEGACY_EVENT_ID && !key.includes(':')))
    .map(([, value]) => value)
    .filter((value) => !excluded.has(Number(value.meta?.club_code)))
  const late = Object.entries(read(STORAGE_KEYS.lateInscriptions, {}))
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value)
    .filter((value) => !excluded.has(Number(value.meta?.club_code || value.club?.code)))
  return buildConsolidatedExport({
    event: demoGetEvent(eventId) || legacyEvent(),
    inscriptions,
    lateInscriptions: late,
    type
  })
}
