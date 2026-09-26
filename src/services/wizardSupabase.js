import { accessFromDemoToken, decodeDemoToken } from '../utils/demoToken.js'
import { verifyMagicToken } from '../utils/magicToken.js'
import { generateClubPin } from '../utils/clubPin.js'
import { teamIdentity } from '../utils/teamUtils.js'
import { isShortId } from '../utils/shortId.js'
import { RateLimitError, checkPinRateLimit, clearPinRateLimit, pinRateLimitStatus } from './pinRateLimit.js'
import { hasLateDecision } from './lateDecision.js'
import { CONFLICT_TEXT, ConflictError, DRAFT_CONFLICT_TEXT, DRAFT_STALE_TEXT, LATE_DECIDED_TEXT, STALE_CLIENT_SERVER_MESSAGE, sameRoster } from './concurrency.js'
import { isRegistrationOpen, notOpenText } from '../utils/registrationStatus.js'

const DEFAULT_WHATSAPP = ''

// v1.21.0 — Borrador en el servidor (tabla inscription_drafts). Nunca es una inscripción:
// el consolidado, el tablero y "Ver inscripciones" solo leen `inscriptions`.
export const DRAFTS_TABLE = 'inscription_drafts'
export const MAX_DRAFT_ATHLETES = 500
export const MAX_DRAFT_BYTES = 256 * 1024
// Autor del borrador: el correo del enlace v3, o 'link' para el v2 (lo comparten quienes
// comparten el enlace). No depende del token: rotar el enlace no deja huérfano el borrador.
export const draftAuthorKey = (access) => access.authorizedEmail || 'link'

const httpError = (status, message, details = {}) => Object.assign(new Error(message), { status, ...details })

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

// v1.20.1: lista blanca del evento que viaja al entrenador. Solo lo que el wizard lee:
// name (Header, PIN, planilla, JSON), status (pantallas y tardías), deadline (banner),
// reference_date y events (edad y pruebas), organizer y organizer_whatsapp (contacto).
// Nunca clubs (contactos de los demás clubes) ni columnas internas (notes, imported_from…).
export const COACH_EVENT_FIELDS = ['name', 'status', 'deadline', 'reference_date', 'events', 'organizer', 'organizer_whatsapp']
export const coachEvent = (event) => Object.fromEntries(COACH_EVENT_FIELDS.filter((field) => field in (event || {})).map((field) => [field, event[field]]))

// Sin PIN válido solo sale lo básico (evento y club) para mostrar la pantalla del PIN.
// v1.21.0: lista BLANCA (antes se quitaban campos por nombre): un campo nuevo del acceso
// completo (roster, borrador…) nunca viaja sin PIN por olvido.
export const BASIC_ACCESS_FIELDS = ['valid', 'requiresPin', 'backendAvailable', 'eventId', 'event', 'club', 'authorizedEmail', 'whatsapp']
export const basicAccess = (access) => ({
  ...Object.fromEntries(BASIC_ACCESS_FIELDS.filter((field) => field in (access || {})).map((field) => [field, access[field]])),
  requiresPin: true,
  pinVerified: false
})

export const inscriptionFromRow = (row, club = null) => ({
  id: row.id,
  eventId: row.event_id,
  club: club ? withoutPin(club) : { code: row.club_code },
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

export function createSupabaseWizardStorage({ client, adminPassword, whatsapp = DEFAULT_WHATSAPP } = {}) {
  // v1.20.1: sin clave de firma por defecto. Falla cerrado (503 en /api).
  if (typeof adminPassword !== 'string' || !adminPassword.trim()) {
    throw Object.assign(new Error('Servidor mal configurado'), { status: 503 })
  }
  const db = () => {
    if (!client) throw new Error('Supabase no configurado')
    return client
  }

  // Acceso completo del enlace (incluye el roster). Nunca sale del servidor sin PIN:
  // lo filtra validateToken.
  const fullAccess = async (tokenId) => {
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
      // v1.19.2: un evento no abierto ya no invalida el enlace (antes el del correo decía "no
      // es válido"); validateToken lo recorta a lo básico para la pantalla de cerradas.
      const event = await getWizardEvent(db(), magic.e)
      const club = event.clubs.find((item) => Number(item.code) === Number(magic.c))
      if (!club || club.participation_status === 'not_participating' || String(club.email || '').toLowerCase() !== magic.em) return { valid: false }
      const [normal, late] = await Promise.all([latestInscription(db(), event.id, club.code, false), latestInscription(db(), event.id, club.code, true)])
      const current = event.status === 'accepting_late' ? late : normal
      return {
        valid: true,
        requiresPin: true,
        backendAvailable: true,
        eventId: event.id,
        event: coachEvent(event),
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
      requiresPin: true,
      backendAvailable: true,
      eventId: event.id,
      event: coachEvent(event),
      club: withoutPin(club),
      whatsapp: event.organizer_whatsapp || whatsapp,
      already_submitted: Boolean(current),
      inscription: current ? inscriptionFromRow(current, club) : null,
      normal_inscription: normal ? inscriptionFromRow(normal, club) : null
    }
  }

  // v1.16.0: el PIN se exige en el servidor para v2 y v3. Se compara contra
  // event_clubs.pin del evento/club de la FILA guardada del token (no del payload).
  const pinMatches = async (eventId, clubCode, pin) => {
    if (!/^\d{4}$/.test(String(pin ?? ''))) return false
    const relation = unwrap(await db().from('event_clubs').select('pin').eq('event_id', eventId).eq('club_code', clubCode).maybeSingle())
    return Boolean(relation?.pin && relation.pin === String(pin))
  }

  // v1.16.1: con `ip` (lo pasan los handlers de /api) cada PIN enviado cuenta como un
  // intento del par (IP + token canónico) ANTES de comparar; pasado el umbral se rechaza
  // aunque el PIN sea correcto. Un PIN correcto resetea el par. Sin `ip` (llamadas
  // internas/tests) no hay límite. Devuelve { match } o { rateLimited, retryAfter }.
  const guardedPinMatches = async ({ eventId, clubCode, pin, ip, key }) => {
    if (ip) {
      const limit = await checkPinRateLimit(db(), ip, key)
      if (limit.limited) return { match: false, rateLimited: true, retryAfter: limit.retryAfter }
    }
    const match = await pinMatches(eventId, clubCode, pin)
    if (match && ip) await clearPinRateLimit(db(), ip, key)
    return { match }
  }

  // v1.17.0: un enlace corto es solo un alias de URL de una fila de `tokens`. Se
  // traduce al token largo ANTES de cualquier lógica (PIN incluido); los largos pasan
  // tal cual. Un corto inexistente devuelve null.
  const resolveToken = async (tokenId) => {
    if (!isShortId(tokenId)) return tokenId
    if (!client) return null
    const row = unwrap(await db().from('tokens').select('token_value').eq('short_id', tokenId).maybeSingle())
    return row?.token_value || null
  }

  const checkAccess = async (tokenId, { pin, admin = false, ip } = {}) => {
    const token = await resolveToken(tokenId)
    if (!token) return { valid: false }
    const access = await fullAccess(token)
    // Sin fila guardada (o sin backend) no hay datos del servidor que proteger;
    // además no se puede enviar (submit exige backendAvailable).
    if (!access.valid || !access.backendAvailable) return access
    // v1.19.2: evento no abierto (draft/closed/archived): solo lo básico para mostrar la
    // pantalla correspondiente. Nunca el roster, con o sin PIN (tampoco en la vista previa del
    // admin), y el PIN no se evalúa: no hay nada detrás que proteger.
    if (!isRegistrationOpen(access.event.status)) return basicAccess(access)
    if (admin) return { ...access, pinVerified: true }
    // Sin PIN (primera carga) no es un intento: no cuenta para el límite.
    if (pin === undefined || pin === null || pin === '') return basicAccess(access)
    const check = await guardedPinMatches({ eventId: access.eventId, clubCode: access.club.code, pin, ip, key: await tokenKey(token) })
    if (check.match) return { ...access, pinVerified: true }
    // Bloqueado: 200 con lo básico (sin roster) para que la pantalla del PIN muestre el aviso.
    if (check.rateLimited) return { ...basicAccess(access), rateLimited: true, retryAfter: check.retryAfter }
    return basicAccess(access)
  }

  // v1.21.0: el borrador del autor viaja solo con PIN verificado. Nunca en la vista previa
  // del admin (el admin no ve el contenido de un borrador). Sin la tabla: draft null.
  const readDraft = async (access) => {
    try {
      const result = await db()
        .from(DRAFTS_TABLE)
        .select('roster,base_version,rev')
        .eq('event_id', access.eventId)
        .eq('club_code', access.club.code)
        .eq('is_late', access.event.status === 'accepting_late')
        .eq('author_key', draftAuthorKey(access))
        .maybeSingle()
      if (result.error) throw result.error
      return result.data || null
    } catch (error) {
      console.warn('[borrador] no se pudo leer:', error?.message || error)
      return null
    }
  }

  const validateToken = async (tokenId, options = {}) => {
    const access = await checkAccess(tokenId, options)
    if (!access.pinVerified || options.admin) return access
    return { ...access, draft: await readDraft(access) }
  }

  const verifyAccessPin = async (tokenId, pin, { ip } = {}) => {
    if (!client) return { valid: false }
    const token = await resolveToken(tokenId)
    if (!token) return { valid: false }
    const stored = unwrap(
      await db()
        .from('tokens')
        .select('event_id,club_code')
        .eq('id', await tokenKey(token))
        .maybeSingle()
    )
    if (!stored) return { valid: false }
    const check = await guardedPinMatches({ eventId: stored.event_id, clubCode: stored.club_code, pin, ip, key: await tokenKey(token) })
    if (check.rateLimited) throw new RateLimitError(check.retryAfter)
    return { valid: check.match }
  }

  const submitInscription = async (payload, { admin = false, ip } = {}) => {
    // Token largo canónico: se usa para validar, para token_id y para used_at.
    const token = await resolveToken(payload.token)
    if (!token) throw new Error('El enlace no es válido')
    const access = await checkAccess(token, { pin: payload.pin, admin, ip })
    if (access.rateLimited) throw new RateLimitError(access.retryAfter)
    if (!access.valid) throw new Error('El enlace no es válido')
    if (!access.backendAvailable) throw new Error('No se pudo conectar con Supabase')
    // v1.19.2: antes que el PIN, porque con el evento no abierto validateToken no lo evalúa.
    if (!isRegistrationOpen(access.event.status)) throw new Error(notOpenText(access.event.status))
    if (!access.pinVerified) throw new Error('Código de acceso incorrecto o faltante')
    const isLate = access.event.status === 'accepting_late'
    // v1.18.0: escritura condicional por versión (anti-pisado). expected_version es la
    // versión de la fila sobre la que el cliente trabajó (0/null = no había fila).
    // Un cliente sin el campo es un bundle viejo (anterior al deploy): se le pide recargar.
    const expected = payload.expected_version
    if (expected === undefined) throw new ConflictError(STALE_CLIENT_SERVER_MESSAGE, { staleClient: true })
    const expectedVersion = expected === null ? 0 : Number(expected)
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ConflictError(STALE_CLIENT_SERVER_MESSAGE, { staleClient: true })
    // (a) Tardía ya revisada por el organizador (D1): el entrenador no puede re-enviarla.
    // Si el admin decide DESPUÉS de esta lectura, reviewLate sube la versión y (b) no calza.
    if (isLate && hasLateDecision(access.inscription)) throw new ConflictError(LATE_DECIDED_TEXT, { lateDecided: true })
    const content = {
      token_id: token,
      submitted_at: new Date().toISOString(),
      late_status: isLate ? 'pending' : null,
      athletes: payload.athletes,
      results: payload.results,
      roster: payload.roster || [],
      meta: payload.meta || {},
      approved_athletes: [],
      rejected_athletes: []
    }
    const key = { event_id: access.eventId, club_code: access.club.code, is_late: isLate }
    // (b) Una sola sentencia atómica: INSERT (sin fila; el UNIQUE frena al segundo) o
    // UPDATE ... WHERE version = expected (0 filas = alguien escribió antes).
    let row = null
    if (expectedVersion === 0) {
      const inserted = await db().from('inscriptions').insert({ ...key, ...content, version: 1 }).select().single()
      if (inserted.error && inserted.error.code !== '23505') unwrap(inserted)
      row = inserted.error ? null : inserted.data
    } else {
      const updated = unwrap(
        await db()
          .from('inscriptions')
          .update({ ...content, version: expectedVersion + 1 })
          .eq('event_id', key.event_id)
          .eq('club_code', key.club_code)
          .eq('is_late', key.is_late)
          .eq('version', expectedVersion)
          .select()
      )
      row = updated?.[0] || null
    }
    // (c) Conflicto. Si lo que hay en el servidor es idéntico a lo enviado (doble click,
    // reintento por red lenta) es un éxito: no se escribe nada y se devuelve la versión actual.
    if (!row) {
      const current = await latestInscription(db(), key.event_id, key.club_code, isLate)
      if (current && sameRoster(current.roster, payload.roster || [])) {
        return { success: true, late: isLate, idempotent: true, version: current.version, summary: { athletes: payload.athletes.length, inscriptions: payload.results.length } }
      }
      throw new ConflictError(CONFLICT_TEXT, { conflict: true, currentVersion: current?.version ?? 0 })
    }
    // Efectos secundarios SOLO si la inscripción se escribió de verdad.
    const updates = await Promise.all([
      db()
        .from('tokens')
        .update({ used_at: row.submitted_at })
        .eq('id', await tokenKey(token)),
      db()
        .from('event_clubs')
        .update({ status: isLate ? 'late_pending' : 'submitted' })
        .eq('event_id', access.eventId)
        .eq('club_code', access.club.code)
    ])
    updates.forEach((result) => unwrap(result))
    await purgeClubDrafts(key)
    return {
      success: true,
      late: isLate,
      version: row.version,
      summary: {
        athletes: payload.athletes.length,
        inscriptions: payload.results.length
      }
    }
  }

  // v1.21.0: al enviar con éxito se borran los borradores del club (de todos sus autores)
  // para ese tipo de inscripción: quedaron basados en una versión vieja. Best-effort.
  const purgeClubDrafts = async (key) => {
    try {
      const result = await db().from(DRAFTS_TABLE).delete().eq('event_id', key.event_id).eq('club_code', key.club_code).eq('is_late', key.is_late)
      if (result.error) throw result.error
    } catch (error) {
      console.warn('[borrador] no se pudo purgar al enviar:', error?.message || error)
    }
  }

  // v1.21.0 — Guardar el borrador del entrenador. Solo con PIN correcto y evento abierto.
  // Un PIN correcto NO registra intento ni consume cupo; uno incorrecto cuenta como en
  // verify-pin; con el par (IP + token) bloqueado se rechaza aunque el PIN sea correcto.
  // La vista previa del admin no cuenta: sin PIN no se guarda.
  // Escritura condicional por rev: nunca pisa un guardado más nuevo (409 draftConflict).
  // Rechaza un borrador basado en una versión de la inscripción ya superada (409 staleBase).
  const saveDraft = async (payload = {}, { ip } = {}) => {
    const token = await resolveToken(payload.token)
    if (!token) throw httpError(400, 'El enlace no es válido')
    const access = await fullAccess(token)
    if (!access.valid || !access.backendAvailable) throw httpError(400, 'El enlace no es válido')
    if (!isRegistrationOpen(access.event.status)) throw httpError(409, notOpenText(access.event.status), { closed: true })
    const roster = payload.roster
    if (!Array.isArray(roster)) throw httpError(400, 'Borrador inválido')
    if (roster.length > MAX_DRAFT_ATHLETES || JSON.stringify(roster).length > MAX_DRAFT_BYTES) throw httpError(413, 'El borrador es demasiado grande')
    const baseVersion = Number(payload.base_version)
    const expectedRev = Number(payload.expected_rev)
    if (!Number.isInteger(baseVersion) || baseVersion < 0 || !Number.isInteger(expectedRev) || expectedRev < 0) throw httpError(400, 'Borrador inválido')

    const key = await tokenKey(token)
    if (ip) {
      const status = await pinRateLimitStatus(db(), ip, key)
      if (status.limited) throw new RateLimitError(status.retryAfter)
    }
    if (!(await pinMatches(access.eventId, access.club.code, payload.pin))) {
      if (ip) {
        const limit = await checkPinRateLimit(db(), ip, key)
        if (limit.limited) throw new RateLimitError(limit.retryAfter)
      }
      throw httpError(401, 'Código de acceso incorrecto o faltante')
    }

    const isLate = access.event.status === 'accepting_late'
    if (isLate && hasLateDecision(access.inscription)) throw new ConflictError(LATE_DECIDED_TEXT, { lateDecided: true })
    const currentVersion = access.inscription?.version ?? 0
    if (currentVersion > baseVersion) throw new ConflictError(DRAFT_STALE_TEXT, { staleBase: true, currentVersion })

    const draftKey = { event_id: access.eventId, club_code: access.club.code, is_late: isLate, author_key: draftAuthorKey(access) }
    const fields = { roster, athlete_count: roster.length, base_version: baseVersion, updated_at: new Date().toISOString() }
    let row = null
    if (expectedRev === 0) {
      const inserted = await db().from(DRAFTS_TABLE).insert({ ...draftKey, ...fields, rev: 1 }).select('rev').single()
      if (inserted.error && inserted.error.code !== '23505') unwrap(inserted)
      row = inserted.error ? null : inserted.data
    } else {
      const updated = unwrap(
        await db()
          .from(DRAFTS_TABLE)
          .update({ ...fields, rev: expectedRev + 1 })
          .eq('event_id', draftKey.event_id)
          .eq('club_code', draftKey.club_code)
          .eq('is_late', draftKey.is_late)
          .eq('author_key', draftKey.author_key)
          .eq('rev', expectedRev)
          .select('rev')
      )
      row = updated?.[0] || null
    }
    if (!row) throw new ConflictError(DRAFT_CONFLICT_TEXT, { draftConflict: true })
    return { saved: true, rev: row.rev }
  }

  return { validateToken, verifyAccessPin, submitInscription, saveDraft }
}
