import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeDemoToken } from '../utils/demoToken'
import {
  __setSupabaseClient,
  getMasterClubs,
  saveEvent,
  updateEventStatus,
  updateLandingSettings,
  upsertClub,
  validateToken
} from './supabaseStorage'

afterEach(() => __setSupabaseClient(null))

// Fake in-memory de Supabase para probar saveEvent sin credenciales reales.
// Modela PostgREST de verdad: upsert() FUSIONA (Object.assign) sobre la fila
// existente cuando hay conflicto -- solo pisa las columnas que vienen en el
// payload -- en vez de reemplazar la fila entera. Es la única forma de que
// el test detecte de verdad si invitation_sent_at sobrevive o no.
function createFakeSupabase(seed = {}) {
  const tables = { events: [], clubs: [], event_clubs: [], event_events: [], tokens: [], audit_log: [], ...seed }

  const matchesFilters = (row, filters) =>
    filters.every(([col, op, value]) => (op === 'in' ? value.includes(row[col]) : row[col] === value))

  function from(table) {
    const state = { op: 'select', filters: [], payload: null, onConflict: [], selectCols: '', single: false, maybeSingle: false, updatePatch: null }
    const builder = {
      select(cols = '*') {
        state.selectCols = cols
        return builder
      },
      eq(col, value) {
        state.filters.push([col, 'eq', value])
        return builder
      },
      in(col, values) {
        state.filters.push([col, 'in', values])
        return builder
      },
      order() {
        return builder
      },
      single() {
        state.single = true
        return builder
      },
      maybeSingle() {
        state.maybeSingle = true
        return builder
      },
      upsert(payload, options = {}) {
        state.op = 'upsert'
        state.payload = Array.isArray(payload) ? payload : [payload]
        state.onConflict = (options.onConflict || 'id').split(',')
        return builder
      },
      insert(payload) {
        state.op = 'insert'
        state.payload = Array.isArray(payload) ? payload : [payload]
        return builder
      },
      update(patch) {
        state.op = 'update'
        state.updatePatch = patch
        return builder
      },
      delete() {
        state.op = 'delete'
        return builder
      },
      then(resolve, reject) {
        try {
          return Promise.resolve(execute()).then(resolve, reject)
        } catch (error) {
          return Promise.reject(error).then(resolve, reject)
        }
      }
    }

    function execute() {
      const rows = tables[table]
      if (state.op === 'upsert') {
        state.payload.forEach((incoming) => {
          const existing = rows.find((row) => state.onConflict.every((col) => row[col] === incoming[col]))
          if (existing) Object.assign(existing, incoming) // MERGE, no reemplaza la fila
          else rows.push({ ...incoming })
        })
        return { data: state.payload, error: null }
      }
      if (state.op === 'insert') {
        rows.push(...state.payload.map((row) => ({ ...row })))
        return { data: state.payload, error: null }
      }
      if (state.op === 'update') {
        rows.filter((row) => matchesFilters(row, state.filters)).forEach((row) => Object.assign(row, state.updatePatch))
        return { data: null, error: null }
      }
      if (state.op === 'delete') {
        const toDelete = rows.filter((row) => matchesFilters(row, state.filters))
        toDelete.forEach((row) => rows.splice(rows.indexOf(row), 1))
        return { data: null, error: null }
      }
      let matched = rows.filter((row) => matchesFilters(row, state.filters))
      if (/clubs\(\*\)/.test(state.selectCols)) {
        matched = matched.map((row) => ({ ...row, clubs: tables.clubs.find((club) => club.code === row.club_code) || null }))
      }
      if (state.single) return matched.length === 1 ? { data: matched[0], error: null } : { data: null, error: { message: 'No encontrado' } }
      if (state.maybeSingle) return { data: matched[0] || null, error: null }
      return { data: matched, error: null }
    }

    return builder
  }

  return { from, tables }
}

describe('adaptador Supabase', () => {
  it('normaliza y guarda clubes con un cliente mock', async () => {
    const saved = { code: 6, name: 'Mantarrayas', short_name: 'MANTARRAYAS', abbreviation: 'MNT' }
    const single = vi.fn().mockResolvedValue({ data: saved, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ upsert }))
    __setSupabaseClient({ from })

    await expect(upsertClub({ code: 6, name: 'Mantarrayas', participation_status: 'invited' })).resolves.toEqual(saved)
    expect(from).toHaveBeenCalledWith('clubs')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ code: 6, name: 'Mantarrayas' }), { onConflict: 'code' })
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('participation_status')
  })

  it('lee la tabla maestra con un cliente mock', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ code: 2, name: 'AKP' }], error: null })
    const select = vi.fn(() => ({ order }))
    __setSupabaseClient({ from: vi.fn(() => ({ select })) })
    await expect(getMasterClubs()).resolves.toEqual([{ code: 2, name: 'AKP' }])
    expect(order).toHaveBeenCalledWith('name')
  })

  it('guarda el estado público como texto', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null })
    const update = vi.fn(() => ({ eq }))
    __setSupabaseClient({ from: vi.fn(() => ({ update })) })

    await expect(updateLandingSettings('evt-1', { drive_url: '', is_live: 'upcoming' })).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_live: 'upcoming' }))
  })

  it('usa el token autocontenido si Supabase no está disponible', async () => {
    const token = encodeDemoToken({
      id: 'evt-1', name: 'Copa', date_start: '2026-12-10', reference_date: '2026-12-10',
      status: 'active', events: [{ event_ptr: 1, distance: 50, style: 'Crawl', age_lo: 10, age_hi: 11, sex: 'F', active: true }]
    }, { code: 2, name: 'AKP' })
    await expect(validateToken(token)).resolves.toMatchObject({ valid: true, backendAvailable: false, eventId: 'evt-1' })
  })
})

describe('saveEvent preserva invitation_sent_at (Sprint 9 Fase 1)', () => {
  function seedEvent() {
    const db = createFakeSupabase()
    db.tables.events.push({
      id: 'evt-1', name: 'Copa Original', date_start: '2026-05-01', date_end: null, venue: 'Sede vieja',
      reference_date: '2026-05-01', deadline: null, course: 'S', notes: '', drive_url: '',
      is_live: 'upcoming', show_on_landing: true, status: 'active', organizer: 'Alberto Surós',
      organizer_whatsapp: '584120000000', imported_from: {}, opened_at: null, closed_at: null,
      created_at: new Date().toISOString()
    })
    db.tables.clubs.push({ code: 5, name: 'Club Cinco', short_name: 'C5', abbreviation: 'CIN' })
    db.tables.clubs.push({ code: 7, name: 'Club Siete', short_name: 'C7', abbreviation: 'SIE' })
    db.tables.event_clubs.push({
      event_id: 'evt-1', club_code: 5, status: 'invited', contact_name: '', contact_whatsapp: '',
      email: 'club5@test.com', pin: '1234', invitation_sent_at: '2026-04-01T10:00:00.000Z', invitation_error: ''
    })
    db.tables.event_clubs.push({
      event_id: 'evt-1', club_code: 7, status: 'invited', contact_name: '', contact_whatsapp: '',
      email: 'club7@test.com', pin: '5678', invitation_sent_at: null, invitation_error: ''
    })
    db.tables.tokens.push({ id: 'tok-5', token_value: 'x', token_type: 'v2', event_id: 'evt-1', club_code: 5, created_at: new Date().toISOString(), used_at: null })
    db.tables.tokens.push({ id: 'tok-7', token_value: 'y', token_type: 'v2', event_id: 'evt-1', club_code: 7, created_at: new Date().toISOString(), used_at: null })
    return db
  }

  it('editar detalles del evento sin tocar el roster preserva invitation_sent_at existente', async () => {
    const db = seedEvent()
    __setSupabaseClient(db)

    await saveEvent({
      id: 'evt-1', name: 'Copa Original', date_start: '2026-05-01', venue: 'Sede NUEVA', reference_date: '2026-05-01', status: 'active',
      clubs: [
        { code: 5, name: 'Club Cinco', pin: '1234', email: 'club5@test.com' },
        { code: 7, name: 'Club Siete', pin: '5678', email: 'club7@test.com' }
      ],
      events: []
    }, false)

    const row5 = db.tables.event_clubs.find((row) => row.club_code === 5)
    const row7 = db.tables.event_clubs.find((row) => row.club_code === 7)
    expect(row5.invitation_sent_at).toBe('2026-04-01T10:00:00.000Z')
    expect(row7.invitation_sent_at).toBeNull()
    expect(db.tables.events.find((row) => row.id === 'evt-1').venue).toBe('Sede NUEVA')
  })

  it('alta: agregar un club nuevo al roster no molesta a los existentes', async () => {
    const db = seedEvent()
    __setSupabaseClient(db)

    await saveEvent({
      id: 'evt-1', name: 'Copa Original', date_start: '2026-05-01', venue: 'Sede vieja', reference_date: '2026-05-01', status: 'active',
      clubs: [
        { code: 5, name: 'Club Cinco', pin: '1234', email: 'club5@test.com' },
        { code: 7, name: 'Club Siete', pin: '5678', email: 'club7@test.com' },
        { code: 9, name: 'Club Nuevo', pin: '9999', email: 'club9@test.com' }
      ],
      events: []
    }, false)

    const row9 = db.tables.event_clubs.find((row) => row.club_code === 9)
    expect(row9).toBeTruthy()
    expect(row9.invitation_sent_at ?? null).toBeNull()
    expect(db.tables.event_clubs.find((row) => row.club_code === 5).invitation_sent_at).toBe('2026-04-01T10:00:00.000Z')
  })

  it('baja: sacar un club del roster borra su fila de event_clubs y sus tokens', async () => {
    const db = seedEvent()
    __setSupabaseClient(db)

    await saveEvent({
      id: 'evt-1', name: 'Copa Original', date_start: '2026-05-01', venue: 'Sede vieja', reference_date: '2026-05-01', status: 'active',
      clubs: [{ code: 5, name: 'Club Cinco', pin: '1234', email: 'club5@test.com' }],
      events: []
    }, false)

    expect(db.tables.event_clubs.some((row) => row.club_code === 7)).toBe(false)
    expect(db.tables.tokens.some((row) => row.club_code === 7)).toBe(false)
    expect(db.tables.event_clubs.some((row) => row.club_code === 5)).toBe(true)
  })
})

describe('reference_date blindado (v1.9.0)', () => {
  it('saveEvent fuerza reference_date al 31 de diciembre del año de date_start, ignorando cualquier valor entrante', async () => {
    const db = createFakeSupabase()
    __setSupabaseClient(db)

    await saveEvent({
      name: 'Copa Navidad', date_start: '2026-09-19', venue: 'Piscina Municipal', reference_date: '2026-09-19', status: 'draft',
      clubs: [], events: []
    }, false)

    expect(db.tables.events[0].reference_date).toBe('2026-12-31')
  })

  it('saveEvent deriva reference_date aunque no venga en el input (import de Meet Manager)', async () => {
    const db = createFakeSupabase()
    __setSupabaseClient(db)

    await saveEvent({
      name: 'Copa Verano', date_start: '2027-03-02', venue: 'Piscina Municipal', status: 'draft',
      clubs: [], events: []
    }, false)

    expect(db.tables.events[0].reference_date).toBe('2027-12-31')
  })
})

describe('audit log de acciones del admin (v1.14.0)', () => {
  const ROW = {
    id: 'evt-1', name: 'Copa', date_start: '2026-05-01', date_end: null, venue: 'Sede A',
    reference_date: '2026-12-31', deadline: null, course: 'S', notes: '', drive_url: '',
    is_live: 'upcoming', show_on_landing: true, organizer: 'Org', organizer_whatsapp: '584120000000',
    imported_from: {}, opened_at: null, closed_at: null, created_at: '2026-04-01T00:00:00.000Z'
  }
  const PRUEBA = { event_ptr: 1, distance: 50, style: 'Libre', age_lo: 9, age_hi: 10, sex: 'F', active: true }

  function seed(status) {
    const db = createFakeSupabase()
    db.tables.events.push({ ...ROW, status })
    db.tables.clubs.push({ code: 5, name: 'Club Cinco', short_name: 'C5', abbreviation: 'CIN' })
    db.tables.event_clubs.push({ event_id: 'evt-1', club_code: 5, status: 'invited', contact_name: '', contact_whatsapp: '', email: '', pin: '1234', invitation_sent_at: null, invitation_error: '' })
    db.tables.event_events.push({ event_id: 'evt-1', ...PRUEBA })
    return db
  }
  // Formulario tal como lo carga el editor: mismos valores que la fila guardada.
  const form = (patch = {}) => ({ ...ROW, clubs: [{ code: 5, name: 'Club Cinco', pin: '1234' }], events: [{ ...PRUEBA }], ...patch })

  // Envuelve el fake para romper tablas a pedido.
  function breaking(db, { audit, eventsUpdate } = {}) {
    return {
      tables: db.tables,
      from(table) {
        if (table === 'audit_log' && audit === 'throw') return { insert: () => Promise.reject(new Error('audit caído')) }
        if (table === 'audit_log' && audit === 'error') return { insert: () => Promise.resolve({ data: null, error: { message: 'RLS' } }) }
        const builder = db.from(table)
        if (table === 'events' && eventsUpdate) builder.update = () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'update falló' } }) })
        return builder
      }
    }
  }

  it('updateEventStatus closed → active registra event.reopened con from/to', async () => {
    const db = seed('closed')
    __setSupabaseClient(db)
    await updateEventStatus('evt-1', 'active')
    expect(db.tables.audit_log).toEqual([{ action: 'event.reopened', event_id: 'evt-1', club_code: null, details: { from: 'closed', to: 'active', via: 'dashboard' }, outcome: 'success' }])
  })

  it('updateEventStatus registra cierre con tardías, cierre definitivo y archivo', async () => {
    const db = seed('active')
    __setSupabaseClient(db)
    await updateEventStatus('evt-1', 'accepting_late')
    await updateEventStatus('evt-1', 'closed')
    await updateEventStatus('evt-1', 'archived')
    expect(db.tables.audit_log.map((row) => row.action)).toEqual(['event.closed_accepting_late', 'event.closed_final', 'event.archived'])
  })

  it('saveEvent(form, true) sobre un evento cerrado registra event.reopened vía editor', async () => {
    const db = seed('closed')
    __setSupabaseClient(db)
    await saveEvent(form({ status: 'closed' }), true)
    expect(db.tables.audit_log).toEqual([expect.objectContaining({ action: 'event.reopened', details: { from: 'closed', to: 'active', via: 'editor' } })])
  })

  it('reabrir silencioso: base cerrada, formulario viejo en active, "Guardar cambios" queda registrado', async () => {
    const db = seed('closed')
    __setSupabaseClient(db)
    await saveEvent(form({ status: 'active' }), false)
    expect(db.tables.events[0].status).toBe('active') // no se tapa en este sprint, solo se registra
    expect(db.tables.audit_log).toEqual([expect.objectContaining({ action: 'event.reopened', details: { from: 'closed', to: 'active', via: 'editor' } })])
  })

  it('editar evento registra solo los nombres de los campos cambiados, sin valores', async () => {
    const db = seed('active')
    __setSupabaseClient(db)
    await saveEvent(form({ status: 'active', venue: 'Sede Nueva Secreta', drive_url: 'https://drive.example/x' }), false)
    expect(db.tables.audit_log).toEqual([{ action: 'event.details_updated', event_id: 'evt-1', club_code: null, details: { campos: ['drive_url', 'venue'], via: 'editor' }, outcome: 'success' }])
    expect(JSON.stringify(db.tables.audit_log)).not.toMatch(/Secreta|drive\.example/)
  })

  it('cambios de clubes y pruebas se registran como nombres de campo, sin detalle por club', async () => {
    const db = seed('active')
    __setSupabaseClient(db)
    await saveEvent(form({ status: 'active', clubs: [{ code: 5, name: 'Club Cinco', pin: '1234' }, { code: 9, name: 'Club Nueve', pin: '9999', email: 'x@y.com' }], events: [{ ...PRUEBA, distance: 100 }] }), false)
    expect(db.tables.audit_log[0].details).toEqual({ campos: ['clubs', 'pruebas'], via: 'editor' })
    expect(JSON.stringify(db.tables.audit_log)).not.toMatch(/Nueve|x@y|9999/)
  })

  it('guardar sin cambios no registra nada; crear un evento tampoco', async () => {
    const db = seed('active')
    __setSupabaseClient(db)
    await saveEvent(form({ status: 'active' }), false)
    await saveEvent({ name: 'Nuevo', date_start: '2026-06-01', venue: 'X', status: 'draft', clubs: [], events: [] }, false)
    expect(db.tables.audit_log).toEqual([])
  })

  it.each(['throw', 'error'])('si el audit log falla (%s), la acción principal sigue igual', async (audit) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = seed('closed')
    __setSupabaseClient(breaking(db, { audit }))
    await expect(updateEventStatus('evt-1', 'archived')).resolves.toMatchObject({ status: 'archived' })
    await expect(saveEvent(form({ status: 'archived', venue: 'Otra' }), true)).resolves.toMatchObject({ status: 'active', venue: 'Otra' })
    expect(db.tables.audit_log).toEqual([])
    warn.mockRestore()
  })

  it('si la acción principal falla, registra outcome failure y relanza el error', async () => {
    const db = seed('active')
    __setSupabaseClient(breaking(db, { eventsUpdate: true }))
    await expect(updateEventStatus('evt-1', 'closed')).rejects.toThrow('update falló')
    expect(db.tables.events[0].status).toBe('active')
    expect(db.tables.audit_log).toEqual([expect.objectContaining({ action: 'event.closed_final', outcome: 'failure' })])
  })
})
