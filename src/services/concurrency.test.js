import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — Guardias de concurrencia. Club 5, PIN '1234'. `payload()` es un cliente al
// día (expected_version = versión actual); una vista vieja fija expected_version a mano.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: submitHandler } = await import('../../api/submit-inscription.js')
const { default: validateHandler } = await import('../../api/validate-token.js')
const { __setSupabaseClient, getDashboard, reviewLate } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { CONFLICT_TEXT, LATE_DECIDED_TEXT, STALE_CLIENT_SERVER_MESSAGE, STALE_CLIENT_TEXT } = await import('./concurrency.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')

const names = (row) => (row?.roster || []).map((athlete) => athlete.lastName)
const stale = (body, version) => ({ ...body, expected_version: version })
const seenLate = async () => (await getDashboard('evt-1')).late.find((item) => Number(item.club.code) === 5)
const response = () => ({
  statusCode: 0,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})
const call = async (handler, body) => {
  const res = response()
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': '1.1.1.1' } }, res)
  return res
}

let db, token, wizard
const normalRow = () => db.tables.inscriptions.find((row) => !row.is_late)
const lateRow = () => db.tables.inscriptions.find((row) => row.is_late)
const clubStatus = () => db.tables.event_clubs.find((row) => row.club_code === 5).status
const writesTo = (table) => db.calls.filter((item) => item.table === table && item.op !== 'select').length

beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  ;({ db, token } = await seed())
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  mocks.client = { from: db.from, auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no' } }) } }
})
afterEach(() => __setSupabaseClient(null))

describe('A — pisado entre entrenadores', () => {
  it('A y B cargan la versión 1; A envía; B envía sobre la vista vieja → 409 y lo de A queda intacto', async () => {
    await wizard.submitInscription(payload(token, 2, 'BASE'))
    const seenByB = (await wizard.validateToken(token, { pin: '1234' })).inscription
    expect(seenByB.version).toBe(1)
    await wizard.submitInscription(payload(token, 3, 'A')) // A al día: 1 → 2
    const statusBefore = clubStatus()
    const clubWrites = writesTo('event_clubs')
    await expect(wizard.submitInscription(stale(payload(token, 1, 'B'), seenByB.version))).rejects.toMatchObject({
      status: 409,
      message: CONFLICT_TEXT,
      details: { conflict: true, currentVersion: 2 }
    })
    expect(names(normalRow())).toEqual(['A0', 'A1', 'A2'])
    expect(normalRow().version).toBe(2)
    // Efectos secundarios solo en éxito: el conflicto no toca event_clubs.
    expect(writesTo('event_clubs')).toBe(clubWrites)
    expect(clubStatus()).toBe(statusBefore)
  })

  it('el endpoint responde 409 { conflict, currentVersion } sin escribir', async () => {
    await wizard.submitInscription(payload(token, 2, 'BASE'))
    await wizard.submitInscription(payload(token, 3, 'A'))
    const res = await call(submitHandler, stale(payload(token, 1, 'B'), 1))
    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({ conflict: true, currentVersion: 2, error: CONFLICT_TEXT })
    expect(names(normalRow())).toEqual(['A0', 'A1', 'A2'])
  })

  it('primer envío con una vista sin fila (versión 0) cuando otro ya envió → conflicto', async () => {
    await wizard.submitInscription(payload(token, 2, 'PRIMERO'))
    await expect(wizard.submitInscription(stale(payload(token, 1, 'SEGUNDO'), 0))).rejects.toMatchObject({ status: 409, details: { conflict: true, currentVersion: 1 } })
    await expect(wizard.submitInscription(stale(payload(token, 1, 'SEGUNDO'), null))).rejects.toMatchObject({ status: 409 })
    expect(names(normalRow())).toEqual(['PRIMERO0', 'PRIMERO1'])
  })

  it('validate-token entrega la versión de la fila (null si no hay)', async () => {
    expect((await call(validateHandler, { token, pin: '1234' })).body.inscription).toBeNull()
    await wizard.submitInscription(payload(token, 1))
    expect((await call(validateHandler, { token, pin: '1234' })).body.inscription.version).toBe(1)
  })
})

describe('cliente viejo (bundle anterior al deploy)', () => {
  it('sin expected_version → 409 { staleClient } con su propio texto, sin escribir nada', async () => {
    const { expected_version: _ignored, ...legacy } = { ...payload(token, 2, 'VIEJO') }
    const res = await call(submitHandler, legacy)
    expect(res.statusCode).toBe(409)
    // Sin punto final: el bundle viejo agrega ". Tu lista sigue guardada…" por su cuenta.
    expect(res.body).toMatchObject({ staleClient: true, error: STALE_CLIENT_SERVER_MESSAGE })
    expect(`${res.body.error}.`).toBe(STALE_CLIENT_TEXT)
    expect(res.body.error).not.toBe(CONFLICT_TEXT)
    expect(db.tables.inscriptions).toHaveLength(0)
    expect(clubStatus()).toBe('invited')
  })
})

describe('doble click / reintento', () => {
  it('dos envíos idénticos sobre la versión 1 → ambos éxito, una fila, versión 2 (no 3), un solo efecto secundario', async () => {
    await wizard.submitInscription(payload(token, 2, 'BASE'))
    const clubWrites = writesTo('event_clubs')
    const body = stale(payload(token, 3, 'MISMO'), 1)
    const results = await Promise.all([wizard.submitInscription(body), wizard.submitInscription(body)])
    expect(results.every((result) => result.success)).toBe(true)
    expect(results.map((result) => result.version)).toEqual([2, 2])
    expect(results.filter((result) => result.idempotent)).toHaveLength(1)
    expect(db.tables.inscriptions).toHaveLength(1)
    expect(normalRow().version).toBe(2)
    expect(writesTo('event_clubs')).toBe(clubWrites + 1)
  })

  it('primer envío doble (sin fila) idéntico → ambos éxito, una fila en versión 1', async () => {
    const seeded = await seed({ barrier: 2 }) // los dos INSERT llegan juntos a la base
    const first = createSupabaseWizardStorage({ client: seeded.db, adminPassword: MAGIC_SIGNING_KEY })
    const body = stale(payload(seeded.token, 2, 'X'), 0)
    const results = await Promise.all([first.submitInscription(body), first.submitInscription(body)])
    expect(results.every((result) => result.success && result.version === 1)).toBe(true)
    expect(seeded.db.tables.inscriptions).toHaveLength(1)
    expect(seeded.db.tables.inscriptions[0].version).toBe(1)
  })
})

describe('tardías: D1 y aprobaciones', () => {
  beforeEach(async () => {
    db.tables.events[0].status = 'accepting_late'
    await wizard.submitInscription(payload(token, 2, 'TARDE'))
  })

  it('tardía aprobada + re-envío del entrenador (versión vieja o al día) → 409 lateDecided y la aprobación queda intacta', async () => {
    await reviewLate('evt-1', 5, 'approve_pending', [], await seenLate())
    expect(lateRow()).toMatchObject({ late_status: 'approved', approved_athletes: [5001, 5002], version: 2 })
    expect(clubStatus()).toBe('late_approved')
    for (const body of [stale(payload(token, 3, 'TARDE'), 1), payload(token, 3, 'TARDE')]) {
      await expect(wizard.submitInscription(body)).rejects.toMatchObject({ status: 409, message: LATE_DECIDED_TEXT, details: { lateDecided: true } })
    }
    expect(lateRow()).toMatchObject({ late_status: 'approved', approved_athletes: [5001, 5002], version: 2 })
    expect(clubStatus()).toBe('late_approved')
  })

  it('también bloquea tras una decisión parcial o un rechazo', async () => {
    await reviewLate('evt-1', 5, 'reject', [5001], await seenLate())
    await expect(wizard.submitInscription(payload(token, 3, 'TARDE'))).rejects.toMatchObject({ details: { lateDecided: true } })
    expect(lateRow()).toMatchObject({ late_status: 'partially_approved', rejected_athletes: [5001] })
  })

  it('carrera: el admin decide ENTRE el chequeo (a) y el UPDATE (b) → la versión frena el pisado', async () => {
    const seen = await seenLate()
    let fired = false
    // Cliente del servidor que, justo antes del primer UPDATE de inscriptions, deja que el
    // admin apruebe (el admin escribe por su propio cliente: el fake crudo).
    const racing = {
      from(table) {
        const builder = db.from(table)
        if (table !== 'inscriptions') return builder
        const update = builder.update
        builder.update = (patch) => {
          update(patch)
          if (!fired) {
            fired = true
            const then = builder.then
            builder.then = (resolve, reject) => reviewLate('evt-1', 5, 'approve_pending', [], seen).then(() => then(resolve, reject), reject)
          }
          return builder
        }
        return builder
      }
    }
    const racingWizard = createSupabaseWizardStorage({ client: racing, adminPassword: MAGIC_SIGNING_KEY })
    // El entrenador tiene la versión 1 (pendiente): pasa (a), pero el admin aprueba antes de (b).
    await expect(racingWizard.submitInscription(payload(token, 3, 'OTRA'))).rejects.toMatchObject({ status: 409, details: { conflict: true, currentVersion: 2 } })
    expect(fired).toBe(true)
    expect(lateRow()).toMatchObject({ late_status: 'approved', approved_athletes: [5001, 5002], version: 2 })
    expect(names(lateRow())).toEqual(['TARDE0', 'TARDE1'])
    expect(clubStatus()).toBe('late_approved')
  })

  it('pendiente: el entrenador puede re-enviar (versión al día) y sigue pendiente', async () => {
    await expect(wizard.submitInscription(payload(token, 3, 'TARDE'))).resolves.toMatchObject({ success: true, version: 2 })
    expect(lateRow()).toMatchObject({ late_status: 'pending', version: 2 })
  })
})

describe('admin — reviewLate con la vista del tablero', () => {
  beforeEach(async () => {
    db.tables.events[0].status = 'accepting_late'
    await wizard.submitInscription(payload(token, 2, 'VIEJO'))
  })

  it('el entrenador re-envía después de que el admin cargó el tablero → conflicto; no aprueba a nadie que el admin no vio', async () => {
    const seen = await seenLate() // el admin ve VIEJO0 (5001) y VIEJO1 (5002)
    await wizard.submitInscription(payload(token, 2, 'NUEVO')) // versión 1 → 2
    const clubWrites = writesTo('event_clubs')
    for (const [action, ids] of [['approve', [5002]], ['approve_pending', []], ['reject', [5001]]]) {
      await expect(reviewLate('evt-1', 5, action, ids, seen)).rejects.toMatchObject({ status: 409 })
    }
    expect(lateRow()).toMatchObject({ late_status: 'pending', approved_athletes: [], rejected_athletes: [], version: 2 })
    expect(writesTo('event_clubs')).toBe(clubWrites)
  })

  it('con la vista al día aprueba y sube la versión; sin vista (llamada vieja) no escribe', async () => {
    await expect(reviewLate('evt-1', 5, 'approve', [5002])).rejects.toMatchObject({ status: 409 })
    expect(lateRow().version).toBe(1)
    await reviewLate('evt-1', 5, 'approve', [5002], await seenLate())
    expect(lateRow()).toMatchObject({ approved_athletes: [5002], late_status: 'partially_approved', version: 2 })
  })

  it('los IDs de "aprobar todos" salen de la vista del tablero, no de una relectura', async () => {
    const seen = await seenLate()
    const reads = db.calls.filter((item) => item.table === 'inscriptions' && item.op === 'select').length
    await reviewLate('evt-1', 5, 'approve_pending', [], seen)
    expect(db.calls.filter((item) => item.table === 'inscriptions' && item.op === 'select').length).toBe(reads)
    expect(lateRow().approved_athletes).toEqual(seen.athletes.map((athlete) => athlete.Ath_no))
  })
})
