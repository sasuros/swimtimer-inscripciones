import { afterEach, describe, expect, it } from 'vitest'
import { createMagicToken } from '../utils/magicToken'
import { DEMO_ADMIN_PASSWORD } from '../config'
import { __setSupabaseClient, exportConsolidated, getInscriptionsForEvent, submitInscription } from './supabaseStorage'
import { tokenKey } from './wizardSupabase.js'

afterEach(() => __setSupabaseClient(null))

const INSCRIPTIONS_UNIQUE = ['event_id', 'club_code', 'is_late']

// Fake de Supabase que modela lo que importa para el envío:
// - UNIQUE(event_id, club_code, is_late) en inscriptions (activable, como la migración).
// - upsert onConflict = INSERT ... ON CONFLICT DO UPDATE atómico; sin constraint que
//   coincida, falla igual que Postgres.
// - barrier: las primeras N escrituras sobre inscriptions esperan a juntarse y salen a la vez,
//   para simular dos envíos que llegan al mismo tiempo (doble click / dos pestañas).
function createFakeSupabase({ uniqueInscriptions = true, barrier = 0 } = {}) {
  const tables = { events: [], clubs: [], event_clubs: [], event_events: [], tokens: [], inscriptions: [] }
  const calls = []
  let nextId = 1
  let clock = Date.parse('2026-10-01T12:00:00Z')
  const waiting = []
  let gatesLeft = barrier
  const atBarrier = () => new Promise((release) => {
    waiting.push(release)
    if (waiting.length === barrier) waiting.splice(0).forEach((go) => go())
  })

  const matchesFilters = (row, filters) => filters.every(([col, op, value]) => (op === 'in' ? value.includes(row[col]) : row[col] === value))
  const sameKey = (a, b, cols) => cols.every((col) => a[col] === b[col])
  const uniqueViolation = { message: 'duplicate key value violates unique constraint "inscriptions_event_club_late_key"', code: '23505' }

  function from(table) {
    const state = { op: 'select', filters: [], payload: null, onConflict: null, selectCols: '*', orderCol: null, orderDesc: false, limitN: null, single: false, maybeSingle: false }
    const builder = {
      select(cols = '*') { state.selectCols = cols; return builder },
      eq(col, value) { state.filters.push([col, 'eq', value]); return builder },
      in(col, values) { state.filters.push([col, 'in', values]); return builder },
      order(col, opts = {}) { state.orderCol = col; state.orderDesc = opts.ascending === false; return builder },
      limit(n) { state.limitN = n; return builder },
      single() { state.single = true; return builder },
      maybeSingle() { state.maybeSingle = true; return builder },
      insert(payload) { state.op = 'insert'; state.payload = [payload].flat(); return builder },
      upsert(payload, options = {}) { state.op = 'upsert'; state.payload = [payload].flat(); state.onConflict = (options.onConflict || 'id').split(','); return builder },
      update(patch) { state.op = 'update'; state.payload = patch; return builder },
      delete() { state.op = 'delete'; return builder },
      then(resolve, reject) {
        const gated = table === 'inscriptions' && state.op !== 'select' && gatesLeft > 0 && gatesLeft-- > 0
        return (gated ? atBarrier() : Promise.resolve()).then(execute).then(resolve, reject)
      }
    }

    const shape = rows => (state.single || state.maybeSingle ? { data: rows[0] ?? null, error: null } : { data: rows, error: null })
    const newRow = row => ({ id: table === 'inscriptions' ? nextId++ : row.id, submitted_at: new Date(clock++).toISOString(), ...row })

    function execute() {
      calls.push({ table, op: state.op, onConflict: state.onConflict?.join(',') })
      const rows = tables[table]
      const enforceUnique = table === 'inscriptions' && uniqueInscriptions
      if (state.op === 'insert') {
        if (enforceUnique && state.payload.some((row) => rows.some((existing) => sameKey(existing, row, INSCRIPTIONS_UNIQUE)))) return { data: null, error: uniqueViolation }
        const inserted = state.payload.map(newRow)
        rows.push(...inserted)
        return shape(inserted)
      }
      if (state.op === 'upsert') {
        if (table === 'inscriptions' && !(uniqueInscriptions && state.onConflict.join(',') === INSCRIPTIONS_UNIQUE.join(','))) {
          return { data: null, error: { message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification', code: '42P10' } }
        }
        const written = state.payload.map((incoming) => {
          const existing = rows.find((row) => sameKey(row, incoming, state.onConflict))
          if (existing) return Object.assign(existing, incoming)
          const inserted = newRow(incoming)
          rows.push(inserted)
          return inserted
        })
        return shape(written)
      }
      if (state.op === 'update') {
        rows.filter((row) => matchesFilters(row, state.filters)).forEach((row) => Object.assign(row, state.payload))
        return { data: null, error: null }
      }
      if (state.op === 'delete') {
        rows.filter((row) => matchesFilters(row, state.filters)).forEach((row) => rows.splice(rows.indexOf(row), 1))
        return { data: null, error: null }
      }
      let matched = rows.filter((row) => matchesFilters(row, state.filters))
      if (/clubs\(\*\)/.test(state.selectCols)) matched = matched.map((row) => ({ ...row, clubs: tables.clubs.find((club) => club.code === row.club_code) || null }))
      if (state.orderCol) matched = [...matched].sort((a, b) => (a[state.orderCol] > b[state.orderCol] ? 1 : -1) * (state.orderDesc ? -1 : 1))
      if (state.limitN) matched = matched.slice(0, state.limitN)
      if (state.single) return matched.length === 1 ? { data: matched[0], error: null } : { data: null, error: { message: 'No encontrado' } }
      return shape(matched)
    }
    return builder
  }

  return { from, tables, calls }
}

async function seed(options) {
  const db = createFakeSupabase(options)
  db.tables.events.push({ id: 'evt-1', name: 'Copa Test', date_start: '2026-10-01', date_end: null, venue: '', reference_date: '2026-12-31', course: 'S', status: 'active', organizer_whatsapp: '584120000000', imported_from: {}, created_at: '2026-09-01T00:00:00Z' })
  db.tables.clubs.push({ code: 5, name: 'Club Cinco', short_name: 'C5', abbreviation: 'CIN' })
  db.tables.event_clubs.push({ event_id: 'evt-1', club_code: 5, status: 'invited', contact_name: '', contact_whatsapp: '', email: 'club5@test.com', pin: '1234', invitation_sent_at: null, invitation_error: '' })
  const token = await createMagicToken({ eventId: 'evt-1', clubCode: 5, email: 'club5@test.com' }, DEMO_ADMIN_PASSWORD)
  db.tables.tokens.push({ id: await tokenKey(token), token_value: token, token_type: 'v3', event_id: 'evt-1', club_code: 5, created_at: '2026-09-01T00:00:00Z', used_at: null })
  __setSupabaseClient(db)
  return { db, token }
}

const athleteSet = n => Array.from({ length: n }, (_, i) => ({ Ath_no: 5000 + i + 1, Last_name: `Nadador${i}`, First_name: 'X', Team_no: 5, Ath_age: 12 }))
const resultSet = n => Array.from({ length: n }, (_, i) => ({ Event_ptr: 1, Ath_no: 5000 + i + 1, ActualSeed_time: '32.50' }))
const payload = (token, n) => ({ token, athletes: athleteSet(n), results: resultSet(n), roster: [], meta: { club_code: 5 } })

describe('envío de inscripción: upsert atómico sobre UNIQUE(event_id, club_code, is_late)', () => {
  it('dos envíos simultáneos del mismo club dejan una sola fila (carrera)', async () => {
    const { token } = await seed({ barrier: 2 })
    await Promise.all([submitInscription(payload(token, 3)), submitInscription(payload(token, 5))])
    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(1)
    expect([3, 5]).toContain(rows[0].athletes.length)
  })

  it('el reenvío reemplaza la fila: datos nuevos, submitted_at nuevo y revisión reseteada', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    const firstSubmittedAt = '2026-01-01T00:00:00.000Z'
    Object.assign(db.tables.inscriptions[0], { submitted_at: firstSubmittedAt, approved_athletes: [5001], rejected_athletes: [5002] })

    await submitInscription(payload(token, 5))
    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].athletes).toHaveLength(5)
    expect(rows[0].submitted_at > firstSubmittedAt).toBe(true)
    expect(rows[0]).toMatchObject({ late_status: null, approved_athletes: [], rejected_athletes: [], is_late: false })
  })

  it('la inscripción normal y la tardía del mismo club conviven', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    db.tables.events[0].status = 'accepting_late'
    await submitInscription(payload(token, 2))
    await submitInscription(payload(token, 4))

    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => !row.is_late).athletes).toHaveLength(3)
    expect(rows.find((row) => row.is_late)).toMatchObject({ late_status: 'pending' })
    expect(rows.find((row) => row.is_late).athletes).toHaveLength(4)
  })

  it('el consolidado no duplica nadadores ni pruebas tras un envío doble', async () => {
    const { token } = await seed({ barrier: 2 })
    await Promise.all([submitInscription(payload(token, 4)), submitInscription(payload(token, 4))])
    const consolidated = await exportConsolidated('evt-1', 'completo')
    expect(consolidated.athletes).toHaveLength(4)
    expect(consolidated.results).toHaveLength(4)
    expect(consolidated.meta.total_athletes).toBe(4)
  })

  it('usa upsert con onConflict y nunca borra inscripciones', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    await submitInscription(payload(token, 3))
    const writes = db.calls.filter((call) => call.table === 'inscriptions' && call.op !== 'select')
    expect(writes).toEqual([
      { table: 'inscriptions', op: 'upsert', onConflict: 'event_id,club_code,is_late' },
      { table: 'inscriptions', op: 'upsert', onConflict: 'event_id,club_code,is_late' }
    ])
  })

  it('sin el UNIQUE en la base el envío falla (por eso la migración va antes del deploy)', async () => {
    const { token } = await seed({ uniqueInscriptions: false })
    await expect(submitInscription(payload(token, 3))).rejects.toThrow(/ON CONFLICT/)
  })
})
