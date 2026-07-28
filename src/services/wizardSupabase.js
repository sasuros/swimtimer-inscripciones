import { accessFromDemoToken, decodeDemoToken } from '../utils/demoToken.js'
import { verifyMagicToken } from '../utils/magicToken.js'
import { generateClubPin } from '../utils/clubPin.js'
import { teamIdentity } from '../utils/teamUtils.js'

const DEFAULT_WHATSAPP = '584120000000'

export const unwrap = (result, message = 'No se pudo completar la operación') => {
  if (result.error) throw new Error(result.error.message || message)
  return result.data
}

export const tokenKey = async (token) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const withoutPin = (club) => {
  const { pin, ...safe } = club || {}
  return safe
}

export const withoutPins = (event) => ({
  ...event,
  clubs: (event.clubs || []).map(withoutPin)
})

export const inscriptionFromRow = (row, club = null) => ({
  id: row.id,
  eventId: row.event_id,
  club: club ? withoutPin(club) : { code: row.club_code },
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

const eventFromRow = (row) => ({
  ...row,
  activated_at: row.opened_at,
  created_at: row.created_at,
  imported_from: row.imported_from || {}
})

async function eventRelations(client, eventId) {
  const [clubRelations, events] = await Promise.all([
    client.from('event_clubs').select('club_code,status,contact_name,contact_whatsapp,email,pin,invitation_sent_at,invitation_error,clubs(*)').eq('event_id', eventId),
    client.from('event_events').select('event_ptr,distance,style,age_lo,age_hi,sex,active').eq('event_id', eventId).order('event_ptr')
  ])
  const relations = unwrap(clubRelations)
  await Promise.all(
    relations
      .filter((relation) => !/^\d{4}$/.test(relation.pin || ''))
      .map(async (relation) => {
        relation.pin = generateClubPin()
        unwrap(await client.from('event_clubs').update({ pin: relation.pin }).eq('event_id', eventId).eq('club_code', relation.club_code))
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

export async function getWizardEvent(client, id) {
  const row = unwrap(await client.from('events').select('*').eq('id', id).single())
  const relations = await eventRelations(client, id)
  return { ...eventFromRow(row), ...relations }
}

export async function latestInscription(client, eventId, clubCode, isLate) {
  const result = await client.from('inscriptions').select('*').eq('event_id', eventId).eq('club_code', clubCode).eq('is_late', isLate).order('submitted_at', { ascending: false }).limit(1).maybeSingle()
  return unwrap(result)
}

export function createSupabaseWizardStorage({ client, adminPassword = 'swimtimer2025', whatsapp = DEFAULT_WHATSAPP } = {}) {
  const db = () => {
    if (!client) throw new Error('Supabase no configurado')
    return client
  }

  const validateToken = async (tokenId) => {
    const magic = await verifyMagicToken(tokenId, adminPassword)
    if (magic) {
      if (!client) return { valid: false }
      const stored = unwrap(
        await db()
          .from('tokens')
          .select('*')
          .eq('id', await tokenKey(tokenId))
          .eq('token_type', 'v3')
          .maybeSingle()
      )
      if (!stored) return { valid: false }
      const event = await getWizardEvent(db(), magic.e)
      if (!['active', 'accepting_late'].includes(event.status)) return { valid: false }
      const club = event.clubs.find((item) => Number(item.code) === Number(magic.c))
      if (!club || club.participation_status === 'not_participating' || String(club.email || '').toLowerCase() !== magic.em) return { valid: false }
      const [normal, late] = await Promise.all([latestInscription(db(), event.id, club.code, false), latestInscription(db(), event.id, club.code, true)])
      const current = event.status === 'accepting_late' ? late : normal
      return {
        valid: true,
        requiresPin: true,
        backendAvailable: true,
        eventId: event.id,
        event: { ...withoutPins(event), date: event.date_start },
        club: withoutPin(club),
        authorizedEmail: magic.em,
        whatsapp: event.organizer_whatsapp || whatsapp,
        already_submitted: Boolean(current),
        inscription: current ? inscriptionFromRow(current, club) : null,
        normal_inscription: normal ? inscriptionFromRow(normal, club) : null
      }
    }

    const embedded = decodeDemoToken(tokenId)
    if (!embedded) return { valid: false }
    const fallback = {
      ...accessFromDemoToken(embedded),
      backendAvailable: false,
      already_submitted: false,
      inscription: null,
      normal_inscription: null
    }
    if (!client) return fallback
    const token = unwrap(
      await db()
        .from('tokens')
        .select('*')
        .eq('id', await tokenKey(tokenId))
        .maybeSingle()
    )
    if (!token) return fallback
    const event = await getWizardEvent(db(), token.event_id)
    const club = event.clubs.find((item) => Number(item.code) === Number(token.club_code)) || fallback.club
    const [normal, late] = await Promise.all([latestInscription(db(), event.id, club.code, false), latestInscription(db(), event.id, club.code, true)])
    const current = event.status === 'accepting_late' ? late : normal
    return {
      valid: true,
      backendAvailable: true,
      eventId: event.id,
      event: { ...withoutPins(event), date: event.date_start },
      club: withoutPin(club),
      whatsapp: event.organizer_whatsapp || whatsapp,
      already_submitted: Boolean(current),
      inscription: current ? inscriptionFromRow(current, club) : null,
      normal_inscription: normal ? inscriptionFromRow(normal, club) : null
    }
  }

  const verifyAccessPin = async (tokenId, pin) => {
    const magic = await verifyMagicToken(tokenId, adminPassword)
    if (!magic) return { valid: false }
    const stored = unwrap(
      await db()
        .from('tokens')
        .select('id')
        .eq('id', await tokenKey(tokenId))
        .eq('token_type', 'v3')
        .maybeSingle()
    )
    if (!stored) return { valid: false }
    const relation = unwrap(await db().from('event_clubs').select('pin').eq('event_id', magic.e).eq('club_code', magic.c).maybeSingle())
    return { valid: Boolean(relation?.pin && relation.pin === String(pin)) }
  }

  const submitInscription = async (payload) => {
    const access = await validateToken(payload.token)
    if (!access.valid) throw new Error('El enlace no es válido')
    if (!access.backendAvailable) throw new Error('No se pudo conectar con Supabase')
    if (['draft', 'closed', 'archived'].includes(access.event.status)) throw new Error('Las inscripciones para este evento están cerradas')
    const isLate = access.event.status === 'accepting_late'
    unwrap(await db().from('inscriptions').delete().eq('event_id', access.eventId).eq('club_code', access.club.code).eq('is_late', isLate))
    const row = unwrap(
      await db()
        .from('inscriptions')
        .insert({
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
        })
        .select()
        .single()
    )
    const updates = await Promise.all([
      db()
        .from('tokens')
        .update({ used_at: row.submitted_at })
        .eq('id', await tokenKey(payload.token)),
      db()
        .from('event_clubs')
        .update({ status: isLate ? 'late_pending' : 'submitted' })
        .eq('event_id', access.eventId)
        .eq('club_code', access.club.code)
    ])
    updates.forEach((result) => unwrap(result))
    return {
      success: true,
      late: isLate,
      summary: {
        athletes: payload.athletes.length,
        inscriptions: payload.results.length
      }
    }
  }

  return { validateToken, verifyAccessPin, submitInscription }
}
