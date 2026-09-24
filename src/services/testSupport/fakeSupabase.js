// Fake de Supabase compartido por los tests de integración del adaptador (no se usa en la app).
import { createMagicToken } from '../../utils/magicToken'
import { DEMO_ADMIN_PASSWORD } from '../../config'
import { __setSupabaseClient } from '../supabaseStorage'
import { tokenKey } from '../wizardSupabase.js'

const INSCRIPTIONS_UNIQUE = ['event_id', 'club_code', 'is_late']

// Fake de Supabase que modela lo que importa para el envío:
// - UNIQUE(event_id, club_code, is_late) en inscriptions (activable, como la migración).
// - upsert onConflict = INSERT ... ON CONFLICT DO UPDATE atómico; sin constraint que
//   coincida, falla igual que Postgres.
// - barrier: las primeras N escrituras sobre inscriptions esperan a juntarse y salen a la vez,
//   para simular dos envíos que llegan al mismo tiempo (doble click / dos pestañas).
export function createFakeSupabase({ uniqueInscriptions = true, barrier = 0 } = {}) {
  const tables = { events: [], clubs: [], event_clubs: [], event_events: [], tokens: [], inscriptions: [], audit_log: [], pin_attempts: [] }
  const calls = []
  let nextId = 1
  let clock = Date.parse('2026-10-01T12:00:00Z')
  const waiting = []
  let gatesLeft = barrier
  const atBarrier = () => new Promise((release) => {
    waiting.push(release)
    if (waiting.length === barrier) waiting.splice(0).forEach((go) => go())
  })

  const compare = { in: (a, b) => b.includes(a), is: (a, b) => (a ?? null) === b, gte: (a, b) => a >= b, lt: (a, b) => a < b, eq: (a, b) => a === b }
  const matchesFilters = (row, filters) => filters.every(([col, op, value]) => compare[op](row[col], value))
  const sameKey = (a, b, cols) => cols.every((col) => a[col] === b[col])
  const uniqueViolation = { message: 'duplicate key value violates unique constraint "inscriptions_event_club_late_key"', code: '23505' }

  function from(table) {
    const state = { op: 'select', filters: [], payload: null, onConflict: null, selectCols: '*', orderCol: null, orderDesc: false, limitN: null, single: false, maybeSingle: false }
    const builder = {
      select(cols = '*') { state.selectCols = cols; return builder },
      eq(col, value) { state.filters.push([col, 'eq', value]); return builder },
      in(col, values) { state.filters.push([col, 'in', values]); return builder },
      is(col, value) { state.filters.push([col, 'is', value]); return builder },
      gte(col, value) { state.filters.push([col, 'gte', value]); return builder },
      lt(col, value) { state.filters.push([col, 'lt', value]); return builder },
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
        const updated = rows.filter((row) => matchesFilters(row, state.filters))
        updated.forEach((row) => Object.assign(row, state.payload))
        return shape(updated)
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

// Último fake sembrado: lo usa payload() para comportarse como un cliente "al día".
let seededDb = null

export async function seed(options) {
  const db = createFakeSupabase(options)
  seededDb = db
  db.tables.events.push({ id: 'evt-1', name: 'Copa Test', date_start: '2026-10-01', date_end: null, venue: '', reference_date: '2026-12-31', course: 'S', status: 'active', organizer_whatsapp: '584120000000', imported_from: {}, created_at: '2026-09-01T00:00:00Z' })
  db.tables.clubs.push({ code: 5, name: 'Club Cinco', short_name: 'C5', abbreviation: 'CIN' })
  db.tables.event_clubs.push({ event_id: 'evt-1', club_code: 5, status: 'invited', contact_name: '', contact_whatsapp: '', email: 'club5@test.com', pin: '1234', invitation_sent_at: null, invitation_error: '' })
  const token = await createMagicToken({ eventId: 'evt-1', clubCode: 5, email: 'club5@test.com' }, DEMO_ADMIN_PASSWORD)
  db.tables.tokens.push({ id: await tokenKey(token), token_value: token, token_type: 'v3', event_id: 'evt-1', club_code: 5, created_at: '2026-09-01T00:00:00Z', used_at: null })
  __setSupabaseClient(db)
  return { db, token }
}

export const athleteSet = n => Array.from({ length: n }, (_, i) => ({ Ath_no: 5000 + i + 1, Last_name: `Nadador${i}`, First_name: 'X', Team_no: 5, Ath_age: 12 }))
export const resultSet = n => Array.from({ length: n }, (_, i) => ({ Event_ptr: 1, Ath_no: 5000 + i + 1, ActualSeed_time: '32.50' }))
export const rosterSet = (n, prefix = 'N') => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, lastName: `${prefix}${i}`, firstName: 'X', sex: 'F', age: 12, events: [] }))
// v1.18.0: expected_version se calcula AL MOMENTO DE ENVIAR (getter) con la fila actual del
// club en el último fake sembrado: es un cliente que acaba de recargar. Para simular una
// vista vieja, fijar el valor: { ...payload(...), expected_version: 1 }.
export const currentVersion = (db, clubCode = 5) => {
  const isLate = db.tables.events[0]?.status === 'accepting_late'
  return db.tables.inscriptions.find((row) => Number(row.club_code) === Number(clubCode) && row.is_late === isLate)?.version ?? 0
}
export const payload = (token, n, prefix = 'N', pin = '1234', clubCode = 5) => ({
  token,
  pin,
  athletes: athleteSet(n),
  results: resultSet(n),
  roster: rosterSet(n, prefix),
  meta: { club_code: 5, club_name: 'Club Cinco' },
  get expected_version() {
    return seededDb ? currentVersion(seededDb, clubCode) : 0
  }
})
