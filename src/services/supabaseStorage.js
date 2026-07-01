import { DEMO_ADMIN_PASSWORD, DEMO_WHATSAPP } from '../config'
import { accessFromDemoToken, decodeDemoToken, encodeDemoToken } from '../utils/demoToken'
import { buildConsolidatedExport } from '../utils/mmSchema'
import { parseMeetManagerConfig } from '../utils/meetManagerImport'
import { teamIdentity } from '../utils/teamUtils'
import { supabase as configuredClient } from './supabase'

let client = configuredClient

export const __setSupabaseClient = value => { client = value }

const db = () => {
  if (!client) throw new Error('Supabase no configurado')
  return client
}

const unwrap = (result, message = 'No se pudo completar la operación') => {
  if (result.error) throw new Error(result.error.message || message)
  return result.data
}

const clubPayload = club => ({
  code: Number(club.code),
  name: club.name,
  short_name: club.short_name || '',
  abbreviation: club.abbreviation || '',
  contact_name: club.contact_name || '',
  contact_whatsapp: club.contact_whatsapp || '',
  contact_email: club.contact_email || ''
})

const tokenKey = async token => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const eventPayload = (input, status) => ({
  id: input.id,
  name: input.name,
  date_start: input.date_start,
  date_end: input.date_end || null,
  venue: input.venue || '',
  reference_date: input.reference_date || input.date_start,
  deadline: input.deadline || null,
  course: input.course || 'S',
  notes: input.notes || '',
  status,
  organizer: input.organizer || 'Alberto Surós',
  organizer_whatsapp: input.organizer_whatsapp || DEMO_WHATSAPP,
  imported_from: input.imported_from || {},
  opened_at: status === 'active' ? (input.opened_at || input.activated_at || new Date().toISOString()) : (input.opened_at || input.activated_at || null),
  closed_at: input.closed_at || null
})

const eventFromRow = row => ({
  ...row,
  activated_at: row.opened_at,
  created_at: row.created_at,
  imported_from: row.imported_from || {}
})

const inscriptionFromRow = (row, club = null) => ({
  id: row.id,
  eventId: row.event_id,
  club: club || { code: row.club_code },
  token: row.token_id,
  submitted_at: row.submitted_at,
  athletes: row.athletes || [],
  results: row.results || [],
  roster: row.roster || [],
  meta: row.meta || {},
  status: row.late_status,
  approved_athletes: row.approved_athletes || [],
  rejected_athletes: row.rejected_athletes || []
})

async function eventRelations(eventId) {
  const [clubRelations, events] = await Promise.all([
    db().from('event_clubs').select('club_code,status,contact_name,contact_whatsapp,clubs(*)').eq('event_id', eventId),
    db().from('event_events').select('event_ptr,distance,style,age_lo,age_hi,sex,active').eq('event_id', eventId).order('event_ptr')
  ])
  const relations = unwrap(clubRelations)
  return {
    clubs: relations.map(relation => teamIdentity({
      ...(relation.clubs || {}),
      code: relation.club_code,
      contact_name: relation.contact_name || relation.clubs?.contact_name || '',
      contact_whatsapp: relation.contact_whatsapp || relation.clubs?.contact_whatsapp || '',
      participation_status: relation.status
    })),
    events: unwrap(events)
  }
}

export async function getEvent(id) {
  const row = unwrap(await db().from('events').select('*').eq('id', id).single())
  const relations = await eventRelations(id)
  return { ...eventFromRow(row), ...relations }
}

export async function getEvents() {
  const rows = unwrap(await db().from('events').select('*').order('created_at', { ascending: false }))
  return Promise.all(rows.map(async row => {
    const dashboard = await getDashboard(row.id)
    return {
      ...dashboard.event,
      progress: {
        received: dashboard.counts.received,
        clubs: dashboard.counts.total_clubs,
        athletes: dashboard.counts.athletes
      }
    }
  }))
}

export const listEvents = getEvents

export async function getMasterClubs() {
  return unwrap(await db().from('clubs').select('*').order('name'))
}

export async function upsertClub(club) {
  const normalized = teamIdentity(club)
  return unwrap(await db().from('clubs').upsert(clubPayload(normalized), { onConflict: 'code' }).select().single())
}

export const addMasterClub = upsertClub

export async function saveEvent(input, activate = false) {
  const id = input.id || `evt_${crypto.randomUUID().slice(0, 8)}`
  const status = activate ? 'active' : (input.status || 'draft')
  const event = { ...input, id }
  unwrap(await db().from('events').upsert(eventPayload(event, status), { onConflict: 'id' }))

  const clubs = (input.clubs || []).map(teamIdentity)
  if (clubs.length) unwrap(await db().from('clubs').upsert(clubs.map(clubPayload), { onConflict: 'code' }))
  const currentTokens = unwrap(await db().from('tokens').select('club_code').eq('event_id', id))
  const selectedCodes = new Set(clubs.map(club => Number(club.code)))
  const removedCodes = currentTokens.map(item => Number(item.club_code)).filter(code => !selectedCodes.has(code))
  if (removedCodes.length) unwrap(await db().from('tokens').delete().eq('event_id', id).in('club_code', removedCodes))

  unwrap(await db().from('event_clubs').delete().eq('event_id', id))
  if (clubs.length) {
    unwrap(await db().from('event_clubs').insert(clubs.map(club => ({
      event_id: id,
      club_code: club.code,
      status: club.participation_status || 'invited',
      contact_name: club.contact_name || '',
      contact_whatsapp: club.contact_whatsapp || ''
    }))))
  }

  unwrap(await db().from('event_events').delete().eq('event_id', id))
  if (input.events?.length) {
    unwrap(await db().from('event_events').insert(input.events.map(eventRow => ({
      event_id: id,
      event_ptr: Number(eventRow.event_ptr),
      distance: Number(eventRow.distance),
      style: eventRow.style,
      age_lo: Number(eventRow.age_lo),
      age_hi: Number(eventRow.age_hi),
      sex: eventRow.sex,
      active: eventRow.active !== false
    }))))
  }
  if (activate) await generateTokens(id)
  return getEvent(id)
}

export const createEvent = data => saveEvent(data, false)
export const updateEvent = (id, data) => saveEvent({ ...data, id }, false)

export async function deleteEvent(id) {
  const event = await getEvent(id)
  if (['active', 'accepting_late'].includes(event.status)) throw new Error('Cierra las inscripciones antes de eliminar el evento.')
  unwrap(await db().from('events').delete().eq('id', id))
  return { success: true }
}

export async function importFromMeetManager(config) {
  return createEvent(parseMeetManagerConfig(config))
}

export async function cloneEvent(id) {
  const source = await getEvent(id)
  return { ...source, id: '', name: '', date_start: '', date_end: null, reference_date: '', deadline: null, venue: '', notes: '', status: 'draft', created_at: '', opened_at: null, activated_at: null, closed_at: null }
}

export async function generateTokens(eventId) {
  const event = await getEvent(eventId)
  const tokens = await Promise.all(event.clubs.map(async club => {
    const tokenValue = encodeDemoToken(event, club)
    return {
      id: await tokenKey(tokenValue),
      token_value: tokenValue,
      event_id: eventId,
      club_code: club.code,
      created_at: new Date().toISOString(),
      used_at: null
    }
  }))
  if (tokens.length) unwrap(await db().from('tokens').upsert(tokens, { onConflict: 'event_id,club_code' }))
  return { success: true, tokens: tokens.map((token, index) => ({ ...token, id: token.token_value, eventId, club: event.clubs[index] })) }
}

export async function getTokensForEvent(eventId) {
  return unwrap(await db().from('tokens').select('*').eq('event_id', eventId))
}

async function latestInscription(eventId, clubCode, isLate) {
  const result = await db().from('inscriptions').select('*')
    .eq('event_id', eventId).eq('club_code', clubCode).eq('is_late', isLate)
    .order('submitted_at', { ascending: false }).limit(1).maybeSingle()
  return unwrap(result)
}

export async function validateToken(tokenId) {
  const embedded = decodeDemoToken(tokenId)
  if (!embedded) return { valid: false }
  const fallback = { ...accessFromDemoToken(embedded), backendAvailable: false, already_submitted: false, inscription: null, normal_inscription: null }
  if (!client) return fallback
  const token = unwrap(await db().from('tokens').select('*').eq('id', await tokenKey(tokenId)).maybeSingle())
  if (!token) return fallback
  const event = await getEvent(token.event_id)
  const club = event.clubs.find(item => Number(item.code) === Number(token.club_code)) || fallback.club
  const [normal, late] = await Promise.all([
    latestInscription(event.id, club.code, false),
    latestInscription(event.id, club.code, true)
  ])
  const current = event.status === 'accepting_late' ? late : normal
  return {
    valid: true,
    backendAvailable: true,
    eventId: event.id,
    event: { ...event, date: event.date_start },
    club,
    whatsapp: event.organizer_whatsapp || DEMO_WHATSAPP,
    already_submitted: Boolean(current),
    inscription: current ? inscriptionFromRow(current, club) : null,
    normal_inscription: normal ? inscriptionFromRow(normal, club) : null
  }
}

export async function submitInscription(payload) {
  const access = await validateToken(payload.token)
  if (!access.valid) throw new Error('El enlace no es válido')
  if (!access.backendAvailable) throw new Error('No se pudo conectar con Supabase')
  if (['draft', 'closed', 'archived'].includes(access.event.status)) throw new Error('Las inscripciones para este evento están cerradas')
  const isLate = access.event.status === 'accepting_late'
  unwrap(await db().from('inscriptions').delete()
    .eq('event_id', access.eventId).eq('club_code', access.club.code).eq('is_late', isLate))
  const row = unwrap(await db().from('inscriptions').insert({
    event_id: access.eventId,
    club_code: access.club.code,
    token_id: payload.token,
    is_late: isLate,
    late_status: isLate ? 'pending' : null,
    athletes: payload.athletes,
    results: payload.results,
    roster: payload.roster || [],
    meta: payload.meta || {},
    approved_athletes: [],
    rejected_athletes: []
  }).select().single())
  const updates = await Promise.all([
    db().from('tokens').update({ used_at: row.submitted_at }).eq('id', await tokenKey(payload.token)),
    db().from('event_clubs').update({ status: isLate ? 'late_pending' : 'submitted' })
      .eq('event_id', access.eventId).eq('club_code', access.club.code)
  ])
  updates.forEach(result => unwrap(result))
  return { success: true, late: isLate, summary: { athletes: payload.athletes.length, inscriptions: payload.results.length } }
}

export const submitLateInscription = (tokenId, data) => submitInscription({ ...data, token: tokenId })

export async function getInscriptionsForEvent(eventId) {
  return unwrap(await db().from('inscriptions').select('*').eq('event_id', eventId).order('submitted_at'))
}

export async function getInscriptionForClub(eventId, clubCode) {
  const row = await latestInscription(eventId, clubCode, false)
  if (!row) throw new Error('Inscripción no encontrada')
  return inscriptionFromRow(row)
}

export const getInscription = getInscriptionForClub

export async function getDashboard(eventId) {
  const [event, tokens, rows] = await Promise.all([
    getEvent(eventId),
    getTokensForEvent(eventId),
    getInscriptionsForEvent(eventId)
  ])
  const latestNormal = new Map()
  rows.filter(row => !row.is_late).forEach(row => latestNormal.set(Number(row.club_code), row))
  const tokenByClub = new Map(tokens.map(token => [Number(token.club_code), token]))
  const clubs = event.clubs.map(club => {
    const inscription = latestNormal.get(Number(club.code))
    const token = tokenByClub.get(Number(club.code))
    const excluded = club.participation_status === 'not_participating'
    return {
      ...club,
      status: excluded ? 'not_participating' : inscription ? 'received' : token ? 'sent' : 'missing',
      athlete_count: excluded ? 0 : (inscription?.athletes?.length || 0),
      submitted_at: excluded ? null : (inscription?.submitted_at || null),
      token: token?.token_value || null
    }
  })
  const clubByCode = new Map(event.clubs.map(club => [Number(club.code), club]))
  const late = rows.filter(row => row.is_late).map(row => inscriptionFromRow(row, clubByCode.get(Number(row.club_code))))
  const submittedDates = clubs.map(club => club.submitted_at).filter(Boolean).sort()
  return {
    event,
    clubs,
    late,
    counts: {
      total_clubs: clubs.length,
      received: clubs.filter(club => club.status === 'received').length,
      pending: clubs.filter(club => !['received', 'not_participating'].includes(club.status)).length,
      athletes: clubs.reduce((sum, club) => sum + club.athlete_count, 0),
      late_pending: late.filter(item => ['pending', 'partially_approved'].includes(item.status)).length
    },
    timestamps: {
      opened_at: event.opened_at || event.activated_at || event.created_at,
      last_submission_at: submittedDates.at(-1) || null,
      closed_at: event.closed_at || null
    }
  }
}

export async function reviewLate(eventId, clubCode, action, athleteIds = []) {
  const row = await latestInscription(eventId, clubCode, true)
  if (!row) throw new Error('Inscripción tardía no encontrada')
  const ids = action === 'approve_all' ? row.athletes.map(athlete => Number(athlete.Ath_no)) : athleteIds.map(Number)
  const approved = new Set((row.approved_athletes || []).map(Number))
  const rejected = new Set((row.rejected_athletes || []).map(Number))
  ids.forEach(id => {
    if (action.startsWith('approve')) { approved.add(id); rejected.delete(id) } else { rejected.add(id); approved.delete(id) }
  })
  const decided = approved.size + rejected.size
  const status = approved.size === row.athletes.length ? 'approved' : rejected.size === row.athletes.length ? 'rejected' : decided ? 'partially_approved' : 'pending'
  const updated = unwrap(await db().from('inscriptions').update({
    approved_athletes: [...approved], rejected_athletes: [...rejected], late_status: status
  }).eq('id', row.id).select().single())
  if (status === 'approved') {
    unwrap(await db().from('event_clubs').update({ status: 'late_approved' })
      .eq('event_id', eventId).eq('club_code', clubCode))
  }
  return inscriptionFromRow(updated)
}

export const approveLateAthletes = (eventId, clubCode, athleteIds) => reviewLate(eventId, clubCode, 'approve', athleteIds)
export const rejectLateAthletes = (eventId, clubCode, athleteIds) => reviewLate(eventId, clubCode, 'reject', athleteIds)

export async function exportConsolidated(eventId, type = 'principal') {
  const [event, rows] = await Promise.all([getEvent(eventId), getInscriptionsForEvent(eventId)])
  const excluded = new Set(event.clubs.filter(club => club.participation_status === 'not_participating').map(club => Number(club.code)))
  const normal = rows.filter(row => !row.is_late && !excluded.has(Number(row.club_code))).map(row => inscriptionFromRow(row))
  const late = rows.filter(row => row.is_late && !excluded.has(Number(row.club_code))).map(row => inscriptionFromRow(row))
  return buildConsolidatedExport({ event, inscriptions: normal, lateInscriptions: late, type })
}

export const exportAll = exportConsolidated
export const exportSupplement = eventId => exportConsolidated(eventId, 'supplement')

export async function updateEventStatus(id, status) {
  const updates = { status }
  if (status === 'active') updates.opened_at = new Date().toISOString()
  if (['accepting_late', 'closed'].includes(status)) updates.closed_at = new Date().toISOString()
  unwrap(await db().from('events').update(updates).eq('id', id))
  if (status === 'active') await generateTokens(id)
  return getEvent(id)
}

export const activateEvent = eventId => updateEventStatus(eventId, 'active')
export const closeEvent = (eventId, acceptLate = false) => updateEventStatus(eventId, acceptLate ? 'accepting_late' : 'closed')
export const archiveEvent = eventId => updateEventStatus(eventId, 'archived')

export async function markClubNotParticipating(eventId, clubCode) {
  unwrap(await db().from('event_clubs').update({ status: 'not_participating' }).eq('event_id', eventId).eq('club_code', clubCode))
  return { success: true }
}

export async function reincorporateClub(eventId, clubCode) {
  unwrap(await db().from('event_clubs').update({ status: 'invited' }).eq('event_id', eventId).eq('club_code', clubCode))
  return { success: true }
}

export const setClubParticipation = (eventId, clubCode, participates) => participates
  ? reincorporateClub(eventId, clubCode)
  : markClubNotParticipating(eventId, clubCode)

export function adminLogin(password) {
  if (password !== DEMO_ADMIN_PASSWORD) throw new Error('Contraseña incorrecta')
  return { token: `supabase-admin-${Date.now()}` }
}
