import { DEMO_ADMIN_PASSWORD, DEMO_WHATSAPP } from '../config'
import { encodeDemoToken } from '../utils/demoToken'
import { buildConsolidatedExport } from '../utils/mmSchema'
import { mergeClubInscriptions } from '../utils/clubInscriptionView'
import { parseMeetManagerConfig } from '../utils/meetManagerImport'
import { teamIdentity } from '../utils/teamUtils'
import { createMagicToken } from '../utils/magicToken'
import { ensureClubPin, generateClubPin, normalizeClubPin } from '../utils/clubPin'
import { generateShortId } from '../utils/shortId'
import { referenceDateFor } from '../utils/referenceDate'
import { supabase as configuredClient } from './supabase'
import { createSupabaseWizardStorage } from './wizardSupabase.js'
import { AUDIT_FIELDS, logAdminAction, statusAction } from './auditLog'
import { ADMIN_CONFLICT_TEXT, ConflictError } from './concurrency.js'
import { applyLateDecision, needsReview } from './lateDecision.js'

let client = configuredClient

export const __setSupabaseClient = (value) => {
  client = value
}

const db = () => {
  if (!client) throw new Error('Supabase no configurado')
  return client
}

const unwrap = (result, message = 'No se pudo completar la operación') => {
  if (result.error) throw new Error(result.error.message || message)
  return result.data
}

const clubPayload = (club) => ({
  code: Number(club.code),
  name: club.name,
  short_name: club.short_name || '',
  abbreviation: club.abbreviation || '',
  contact_name: club.contact_name || '',
  contact_whatsapp: club.contact_whatsapp || '',
  contact_email: club.contact_email || '',
  email: club.email || club.contact_email || ''
})

const tokenKey = async (token) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const eventPayload = (input, status) => ({
  id: input.id,
  name: input.name,
  date_start: input.date_start,
  date_end: input.date_end || null,
  venue: input.venue || '',
  reference_date: referenceDateFor(input.date_start),
  deadline: input.deadline || null,
  course: input.course || 'S',
  notes: input.notes || '',
  drive_url: input.drive_url || '',
  is_live: ['upcoming', 'live', 'finished'].includes(input.is_live) ? input.is_live : input.is_live === true ? 'live' : input.is_live === false ? 'finished' : 'upcoming',
  show_on_landing: input.show_on_landing !== false,
  status,
  organizer: input.organizer || 'Alberto Surós',
  organizer_whatsapp: input.organizer_whatsapp || DEMO_WHATSAPP,
  imported_from: input.imported_from || {},
  opened_at: status === 'active' ? input.opened_at || input.activated_at || new Date().toISOString() : input.opened_at || input.activated_at || null,
  closed_at: input.closed_at || null
})

const eventFromRow = (row) => ({
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
  version: row.version ?? null,
  athletes: row.athletes || [],
  results: row.results || [],
  roster: row.roster || [],
  meta: row.meta || {},
  status: row.late_status,
  approved_athletes: row.approved_athletes || [],
  rejected_athletes: row.rejected_athletes || []
})

async function eventRelations(eventId) {
  const [clubRelations, events] = await Promise.all([db().from('event_clubs').select('club_code,status,contact_name,contact_whatsapp,email,pin,invitation_sent_at,invitation_error,clubs(*)').eq('event_id', eventId), db().from('event_events').select('event_ptr,distance,style,age_lo,age_hi,sex,active').eq('event_id', eventId).order('event_ptr')])
  const relations = unwrap(clubRelations)
  await Promise.all(
    relations
      .filter((relation) => !/^\d{4}$/.test(relation.pin || ''))
      .map(async (relation) => {
        relation.pin = generateClubPin()
        unwrap(await db().from('event_clubs').update({ pin: relation.pin }).eq('event_id', eventId).eq('club_code', relation.club_code))
      })
  )
  return {
    clubs: relations.map((relation) =>
      teamIdentity({
        ...(relation.clubs || {}),
        code: relation.club_code,
        contact_name: relation.contact_name || relation.clubs?.contact_name || '',
        contact_whatsapp: relation.contact_whatsapp || relation.clubs?.contact_whatsapp || '',
        email: relation.email || relation.clubs?.email || relation.clubs?.contact_email || '',
        pin: relation.pin || '',
        invitation_sent_at: relation.invitation_sent_at,
        invitation_error: relation.invitation_error || '',
        participation_status: relation.status
      })
    ),
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
  return Promise.all(
    rows.map(async (row) => {
      const dashboard = await getDashboard(row.id)
      return {
        ...dashboard.event,
        progress: {
          received: dashboard.counts.received,
          clubs: dashboard.counts.total_clubs,
          athletes: dashboard.counts.athletes
        }
      }
    })
  )
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

// Firma estable para comparar: '' / null / undefined valen lo mismo y las claves
// de objetos se ordenan (jsonb no conserva el orden de las claves).
const stableJson = (value) => JSON.stringify(value === '' || value === undefined ? null : value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item))
const DIFF_FIELDS = AUDIT_FIELDS.filter((field) => !['clubs', 'pruebas'].includes(field))
const pruebasSignature = (rows) => stableJson([...rows].map((row) => [Number(row.event_ptr), Number(row.distance), row.style, Number(row.age_lo), Number(row.age_hi), row.sex, row.active !== false]).sort((a, b) => a[0] - b[0]))

// Qué registrar al guardar desde el editor: nombres de campos cambiados. Desde v1.18.0 el
// editor no escribe el estado de un evento existente; el cambio de estado lo registra
// updateEventStatus (con via: 'editor' cuando viene de "Guardar y activar"/"Reabrir").
// Sin fila previa es una creación, que no se registra en Fase 1.
// Si las lecturas fallan, no se registra nada y el guardado sigue igual.
async function editorAuditEntries(id, payload, selectedCodes, currentClubRows, pruebas) {
  try {
    const previous = unwrap(await db().from('events').select('*').eq('id', id).maybeSingle())
    if (!previous) return []
    const previousPruebas = unwrap(await db().from('event_events').select('event_ptr,distance,style,age_lo,age_hi,sex,active').eq('event_id', id))
    const entries = []
    const previousCodes = new Set(currentClubRows.map((row) => Number(row.club_code)))
    const campos = DIFF_FIELDS.filter((field) => stableJson(previous[field]) !== stableJson(payload[field]))
    if (previousCodes.size !== selectedCodes.size || [...selectedCodes].some((code) => !previousCodes.has(code))) campos.push('clubs')
    if (pruebasSignature(previousPruebas) !== pruebasSignature(pruebas)) campos.push('pruebas')
    if (campos.length) entries.push({ action: 'event.details_updated', details: { campos, via: 'editor' } })
    return entries
  } catch (error) {
    console.warn('audit_log:', error?.message)
    return []
  }
}

// v1.18.0 (síntoma C): en un evento que YA EXISTE, el editor no escribe el estado del
// evento (status/opened_at/closed_at): eso lo hace solo updateEventStatus ("Guardar y
// activar" y "Reabrir" pasan por ahí). En los event_clubs existentes escribe solo los
// campos que el formulario cambió respecto de `loaded` (el evento tal como lo cargó el
// editor); status solo si además es un cambio de participación. Así una pestaña vieja
// sin cambios no revierte un cierre, un PIN regenerado ni el status de un club.
// Sin `loaded` (llamadas viejas) no se escriben status ni PIN de clubes existentes.
export async function saveEvent(input, activate = false, loaded = null) {
  const id = input.id || `evt_${crypto.randomUUID().slice(0, 8)}`
  const existing = Boolean(input.id) && Boolean(unwrap(await db().from('events').select('id').eq('id', id).maybeSingle()))
  const status = activate ? 'active' : input.status || 'draft'
  const event = { ...input, id }
  const payload = existing ? eventDetailsPayload(event) : eventPayload(event, status)
  const clubs = (input.clubs || []).map(teamIdentity).map(ensureClubPin)
  const selectedCodes = new Set(clubs.map((club) => Number(club.code)))

  const currentClubRows = unwrap(await db().from('event_clubs').select('club_code').eq('event_id', id))
  const auditEntries = existing ? await editorAuditEntries(id, payload, selectedCodes, currentClubRows, input.events || []) : []
  const logAll = async (outcome) => {
    for (const entry of auditEntries) await logAdminAction(client, { ...entry, eventId: id, outcome })
  }

  try {
    await persistEvent(id, payload, clubs, selectedCodes, currentClubRows, input, { existing, activate, loaded })
  } catch (error) {
    await logAll('failure')
    throw error
  }
  await logAll('success')
  if (existing && activate) return updateEventStatus(id, 'active', { via: 'editor' })
  return getEvent(id)
}

const eventDetailsPayload = (input) => {
  const { status: _status, opened_at: _openedAt, closed_at: _closedAt, ...details } = eventPayload(input, input.status)
  return details
}

const clubContact = (club) => ({
  contact_name: club.contact_name || '',
  contact_whatsapp: club.contact_whatsapp || '',
  email: club.email || club.contact_email || ''
})

const isParticipationChange = (from, to) => from !== to && (from === 'not_participating' || to === 'not_participating')

// Campos de un event_club existente que el formulario cambió respecto de lo cargado.
export function clubChanges(club, loadedClub) {
  const contact = clubContact(club)
  if (!loadedClub) return contact
  const before = clubContact(loadedClub)
  const changes = Object.fromEntries(Object.entries(contact).filter(([key, value]) => value !== before[key]))
  if (club.pin !== normalizeClubPin(loadedClub.pin)) changes.pin = club.pin
  if (isParticipationChange(loadedClub.participation_status, club.participation_status)) changes.status = club.participation_status
  return changes
}

async function persistEvent(id, payload, clubs, selectedCodes, currentClubRows, input, { existing, activate, loaded }) {
  if (existing) unwrap(await db().from('events').update(payload).eq('id', id))
  else unwrap(await db().from('events').upsert(payload, { onConflict: 'id' }))

  if (clubs.length) unwrap(await db().from('clubs').upsert(clubs.map(clubPayload), { onConflict: 'code' }))

  const removedCodes = currentClubRows.map((row) => Number(row.club_code)).filter((code) => !selectedCodes.has(code))
  if (removedCodes.length) {
    unwrap(await db().from('tokens').delete().eq('event_id', id).in('club_code', removedCodes))
    unwrap(await db().from('event_clubs').delete().eq('event_id', id).in('club_code', removedCodes))
  }

  const currentCodes = new Set(currentClubRows.map((row) => Number(row.club_code)))
  const added = clubs.filter((club) => !currentCodes.has(Number(club.code)))
  if (added.length) {
    unwrap(
      await db()
        .from('event_clubs')
        .upsert(
          added.map((club) => ({ event_id: id, club_code: club.code, status: club.participation_status || 'invited', ...clubContact(club), pin: club.pin })),
          { onConflict: 'event_id,club_code' }
        )
    )
  }
  const loadedClubs = new Map((loaded?.clubs || []).map((club) => [Number(club.code), club]))
  for (const club of clubs.filter((item) => currentCodes.has(Number(item.code)))) {
    const changes = clubChanges(club, loadedClubs.get(Number(club.code)))
    if (Object.keys(changes).length) unwrap(await db().from('event_clubs').update(changes).eq('event_id', id).eq('club_code', club.code))
  }

  unwrap(await db().from('event_events').delete().eq('event_id', id))
  if (input.events?.length) {
    unwrap(
      await db()
        .from('event_events')
        .insert(
          input.events.map((eventRow) => ({
            event_id: id,
            event_ptr: Number(eventRow.event_ptr),
            distance: Number(eventRow.distance),
            style: eventRow.style,
            age_lo: Number(eventRow.age_lo),
            age_hi: Number(eventRow.age_hi),
            sex: eventRow.sex,
            active: eventRow.active !== false
          }))
        )
    )
  }
  if (activate && !existing) await generateTokens(id) // existente: lo hace updateEventStatus
}

export const createEvent = (data) => saveEvent(data, false)
export const updateEvent = (id, data) => saveEvent({ ...data, id }, false)

export async function updateLandingSettings(id, settings) {
  const driveUrl = String(settings.drive_url || '').trim()
  const publicState = ['upcoming', 'live', 'finished'].includes(settings.is_live) ? settings.is_live : 'upcoming'
  const result = await db().from('events').update({ drive_url: driveUrl, is_live: publicState, show_on_landing: settings.show_on_landing !== false }).eq('id', id)
  unwrap(result)
  return { success: true }
}

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
    created_at: '',
    opened_at: null,
    activated_at: null,
    closed_at: null
  }
}

async function buildTokenRow(event, club) {
  const tokenValue = encodeDemoToken(withoutPins(event), withoutPin(club))
  return {
    id: await tokenKey(tokenValue),
    token_value: tokenValue,
    token_type: 'v2',
    event_id: event.id,
    club_code: club.code,
    created_at: new Date().toISOString(),
    used_at: null
  }
}

const SHORT_ID_TAKEN = '23505'

// v1.17.0 — Llenado lazy de enlaces cortos: las filas sin short_id reciben uno.
// No bloqueante: si falla (p. ej. falta la migración) se sigue con el enlace largo.
// Solo escribe si la fila sigue sin short_id, así dos pestañas no se pisan.
async function ensureShortIds(rows) {
  await Promise.all(
    rows
      .filter((row) => !row.short_id)
      .map(async (row) => {
        try {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const shortId = generateShortId()
            const result = await db().from('tokens').update({ short_id: shortId }).eq('id', row.id).is('short_id', null).select('short_id')
            if (!result.error) {
              if (result.data?.length) row.short_id = shortId
              else row.short_id = unwrap(await db().from('tokens').select('short_id').eq('id', row.id).maybeSingle())?.short_id || null
              return
            }
            if (result.error.code !== SHORT_ID_TAKEN) return
          }
        } catch {
          // sin enlace corto: la fila sigue funcionando con el largo
        }
      })
  )
  return rows
}

// Upsert de filas que traen short_id nuevo; si choca con el índice único, reintenta con otros.
async function upsertWithFreshShortIds(rows) {
  for (let attempt = 0; ; attempt += 1) {
    rows.forEach((row) => {
      row.short_id = generateShortId()
    })
    const result = await db().from('tokens').upsert(rows, { onConflict: 'event_id,club_code,token_type' })
    if (!result.error || result.error.code !== SHORT_ID_TAKEN || attempt >= 2) return unwrap(result)
  }
}

export async function generateTokens(eventId) {
  const event = await getEvent(eventId)
  const tokens = await Promise.all(event.clubs.map((club) => buildTokenRow(event, club)))
  // Sin short_id en el upsert: Postgres conserva el de cada fila (el enlace corto
  // sobrevive a reactivar/reabrir); las filas nuevas lo reciben en el llenado lazy.
  if (tokens.length) unwrap(await db().from('tokens').upsert(tokens, { onConflict: 'event_id,club_code,token_type' }))
  await ensureShortIds(await getTokensForEvent(eventId))
  return {
    success: true,
    tokens: tokens.map((token, index) => ({
      ...token,
      id: token.token_value,
      eventId,
      club: event.clubs[index]
    }))
  }
}

export async function regenerateClubToken(eventId, clubCode) {
  const event = await getEvent(eventId)
  const club = event.clubs.find((item) => Number(item.code) === Number(clubCode))
  const row = await buildTokenRow(event, club)
  // "Crear enlace nuevo": rota también el enlace corto (el anterior deja de funcionar).
  await upsertWithFreshShortIds([row])
  return { success: true, token: row.short_id }
}

export async function getTokensForEvent(eventId) {
  return unwrap(await db().from('tokens').select('*').eq('event_id', eventId).eq('token_type', 'v2'))
}

export async function generateEmailInvitations(eventId, clubCodes = null) {
  const event = await getEvent(eventId)
  const selected = clubCodes ? new Set(clubCodes.map(Number)) : null
  const clubs = event.clubs.filter((club) => club.email && club.participation_status !== 'not_participating' && (!selected || selected.has(Number(club.code))))
  const invitations = await Promise.all(
    clubs.map(async (club) => {
      const tokenValue = await createMagicToken({ eventId, clubCode: club.code, email: club.email }, DEMO_ADMIN_PASSWORD)
      return {
        club,
        tokenValue,
        row: {
          id: await tokenKey(tokenValue),
          token_value: tokenValue,
          token_type: 'v3',
          event_id: eventId,
          club_code: club.code,
          created_at: new Date().toISOString(),
          used_at: null
        }
      }
    })
  )
  // Cada envío crea un v3 nuevo (como hasta ahora) con su propio enlace corto.
  if (invitations.length) await upsertWithFreshShortIds(invitations.map((item) => item.row))
  return invitations.map(({ club, row }) => ({
    club,
    token: row.short_id
  }))
}

export async function updateClubPin(eventId, clubCode) {
  const pin = generateClubPin()
  unwrap(await db().from('event_clubs').update({ pin }).eq('event_id', eventId).eq('club_code', clubCode))
  return { pin }
}

export async function verifyAccessPin(tokenId, pin) {
  return createSupabaseWizardStorage({ client, adminPassword: DEMO_ADMIN_PASSWORD, whatsapp: DEMO_WHATSAPP }).verifyAccessPin(tokenId, pin)
}

export async function recordInvitationResults(eventId, results) {
  await Promise.all(
    results.map((result) =>
      db()
        .from('event_clubs')
        .update({
          invitation_sent_at: result.success ? new Date().toISOString() : null,
          invitation_error: result.success ? '' : result.error || 'No se pudo enviar'
        })
        .eq('event_id', eventId)
        .eq('club_code', result.clubCode)
        .then((item) => unwrap(item))
    )
  )
  return { success: true }
}

export async function revokeMagicInvitation(eventId, clubCode) {
  unwrap(await db().from('tokens').delete().eq('event_id', eventId).eq('club_code', clubCode).eq('token_type', 'v3'))
  unwrap(await db().from('event_clubs').update({ invitation_sent_at: null, invitation_error: '' }).eq('event_id', eventId).eq('club_code', clubCode))
  return { success: true }
}

async function latestInscription(eventId, clubCode, isLate) {
  const result = await db().from('inscriptions').select('*').eq('event_id', eventId).eq('club_code', clubCode).eq('is_late', isLate).order('submitted_at', { ascending: false }).limit(1).maybeSingle()
  return unwrap(result)
}

export async function validateToken(tokenId, options) {
  return createSupabaseWizardStorage({ client, adminPassword: DEMO_ADMIN_PASSWORD, whatsapp: DEMO_WHATSAPP }).validateToken(tokenId, options)
}

function withoutPin(club) {
  const { pin, ...safe } = club
  return safe
}
function withoutPins(event) {
  return { ...event, clubs: (event.clubs || []).map(withoutPin) }
}

export async function submitInscription(payload, options) {
  return createSupabaseWizardStorage({ client, adminPassword: DEMO_ADMIN_PASSWORD, whatsapp: DEMO_WHATSAPP }).submitInscription(payload, options)
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

// Regular + tardía (cualquiera puede faltar) para "Ver inscripciones" e Imprimir/PDF.
export async function getClubInscriptions(eventId, clubCode) {
  const [regular, late] = await Promise.all([latestInscription(eventId, clubCode, false), latestInscription(eventId, clubCode, true)])
  return { regular: regular ? inscriptionFromRow(regular) : null, late: late ? inscriptionFromRow(late) : null }
}

export async function getDashboard(eventId) {
  const [event, tokens, rows] = await Promise.all([getEvent(eventId), getTokensForEvent(eventId), getInscriptionsForEvent(eventId)])
  await ensureShortIds(tokens)
  const latestNormal = new Map()
  rows.filter((row) => !row.is_late).forEach((row) => latestNormal.set(Number(row.club_code), row))
  const latestLate = new Map()
  rows.filter((row) => row.is_late).forEach((row) => latestLate.set(Number(row.club_code), inscriptionFromRow(row)))
  const tokenByClub = new Map(tokens.map((token) => [Number(token.club_code), token]))
  const clubs = event.clubs.map((club) => {
    const inscription = latestNormal.get(Number(club.code))
    const token = tokenByClub.get(Number(club.code))
    const excluded = club.participation_status === 'not_participating'
    const view = mergeClubInscriptions(inscription, latestLate.get(Number(club.code)))
    return {
      ...club,
      status: excluded ? 'not_participating' : inscription ? 'received' : token ? 'sent' : 'missing',
      athlete_count: excluded ? 0 : view.athleteCount,
      inscription_count: excluded ? 0 : view.resultCount,
      late_approved_count: excluded ? 0 : view.lateApprovedCount,
      submitted_at: excluded ? null : inscription?.submitted_at || null,
      // v1.17.0: el enlace que ve y copia el admin es el corto (el largo sigue válido).
      token: token?.short_id || token?.token_value || null
    }
  })
  const clubByCode = new Map(event.clubs.map((club) => [Number(club.code), club]))
  const late = rows.filter((row) => row.is_late).map((row) => inscriptionFromRow(row, clubByCode.get(Number(row.club_code))))
  const submittedDates = clubs
    .map((club) => club.submitted_at)
    .filter(Boolean)
    .sort()
  return {
    event,
    clubs,
    late,
    counts: {
      total_clubs: clubs.filter((club) => club.status !== 'not_participating').length,
      received: clubs.filter((club) => club.status === 'received').length,
      pending: clubs.filter((club) => !['received', 'not_participating'].includes(club.status)).length,
      athletes: clubs.reduce((sum, club) => sum + club.athlete_count, 0),
      late_pending: late.filter(needsReview).length
    },
    timestamps: {
      opened_at: event.opened_at || event.activated_at || event.created_at,
      last_submission_at: submittedDates.at(-1) || null,
      closed_at: event.closed_at || null
    }
  }
}

// v1.18.0: `seen` es la tardía TAL COMO LA MOSTRÓ el tablero (misma carga que produjo los
// Ath_no de la pantalla): de ahí salen los IDs, las decisiones previas y la versión esperada.
// No se relee la fila: si cambió desde esa carga, el UPDATE condicional no calza y no se
// aprueba a nadie que el admin no vio (los Ath_no son posicionales).
// Semántica de la decisión (final, solo sobre pendientes): lateDecision.js.
export async function reviewLate(eventId, clubCode, action, athleteIds = [], seen = null) {
  if (!seen || !Number.isInteger(seen.version)) throw new ConflictError(ADMIN_CONFLICT_TEXT, { conflict: true })
  const decision = applyLateDecision(seen, action, athleteIds)
  const status = decision.status
  const updated = unwrap(
    await db()
      .from('inscriptions')
      .update({
        approved_athletes: decision.approved_athletes,
        rejected_athletes: decision.rejected_athletes,
        late_status: status,
        version: seen.version + 1
      })
      .eq('event_id', eventId)
      .eq('club_code', clubCode)
      .eq('is_late', true)
      .eq('version', seen.version)
      .select()
  )
  if (!updated?.length) throw new ConflictError(ADMIN_CONFLICT_TEXT, { conflict: true })
  // Efecto secundario solo si la decisión se escribió de verdad.
  if (status === 'approved') {
    unwrap(await db().from('event_clubs').update({ status: 'late_approved' }).eq('event_id', eventId).eq('club_code', clubCode))
  }
  return inscriptionFromRow(updated[0])
}

export const approveLateAthletes = (eventId, clubCode, athleteIds, seen) => reviewLate(eventId, clubCode, 'approve', athleteIds, seen)
export const rejectLateAthletes = (eventId, clubCode, athleteIds, seen) => reviewLate(eventId, clubCode, 'reject', athleteIds, seen)

export async function exportConsolidated(eventId, type = 'principal') {
  const [event, rows] = await Promise.all([getEvent(eventId), getInscriptionsForEvent(eventId)])
  const excluded = new Set(event.clubs.filter((club) => club.participation_status === 'not_participating').map((club) => Number(club.code)))
  const normal = rows.filter((row) => !row.is_late && !excluded.has(Number(row.club_code))).map((row) => inscriptionFromRow(row))
  const late = rows.filter((row) => row.is_late && !excluded.has(Number(row.club_code))).map((row) => inscriptionFromRow(row))
  return buildConsolidatedExport({
    event,
    inscriptions: normal,
    lateInscriptions: late,
    type
  })
}

export const exportAll = exportConsolidated
export const exportSupplement = (eventId) => exportConsolidated(eventId, 'supplement')

export async function updateEventStatus(id, status, { via = 'dashboard' } = {}) {
  let from
  try {
    from = unwrap(await db().from('events').select('status').eq('id', id).maybeSingle())?.status
  } catch (error) {
    console.warn('audit_log:', error?.message) // sin estado previo el log sale sin "from"
  }
  const entry = { action: statusAction(from, status), eventId: id, details: { from, to: status, via } }
  const updates = { status }
  if (status === 'active') updates.opened_at = new Date().toISOString()
  if (['accepting_late', 'closed'].includes(status)) updates.closed_at = new Date().toISOString()
  try {
    unwrap(await db().from('events').update(updates).eq('id', id))
    if (status === 'active') await generateTokens(id)
  } catch (error) {
    await logAdminAction(client, { ...entry, outcome: 'failure' })
    throw error
  }
  await logAdminAction(client, entry)
  return getEvent(id)
}

export const activateEvent = (eventId) => updateEventStatus(eventId, 'active')
export const closeEvent = (eventId, acceptLate = false) => updateEventStatus(eventId, acceptLate ? 'accepting_late' : 'closed')
export const archiveEvent = (eventId) => updateEventStatus(eventId, 'archived')

export async function markClubNotParticipating(eventId, clubCode) {
  unwrap(await db().from('event_clubs').update({ status: 'not_participating' }).eq('event_id', eventId).eq('club_code', clubCode))
  return { success: true }
}

export async function reincorporateClub(eventId, clubCode) {
  unwrap(await db().from('event_clubs').update({ status: 'invited' }).eq('event_id', eventId).eq('club_code', clubCode))
  return { success: true }
}

export const setClubParticipation = (eventId, clubCode, participates) => (participates ? reincorporateClub(eventId, clubCode) : markClubNotParticipating(eventId, clubCode))

export function adminLogin(password) {
  if (password !== DEMO_ADMIN_PASSWORD) throw new Error('Contraseña incorrecta')
  return { token: `supabase-admin-${Date.now()}` }
}
