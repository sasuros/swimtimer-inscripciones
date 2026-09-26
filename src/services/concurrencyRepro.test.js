import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, getEvent, saveEvent, setClubParticipation, updateClubPin, updateEventStatus } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'
import { createSupabaseWizardStorage } from './wizardSupabase.js'
import { MAGIC_SIGNING_KEY } from '../config'

// v1.18.0 — Síntoma C (pestaña vieja del editor de eventos), versión mínima: en un evento
// existente el editor no escribe status/opened_at/closed_at, y en los event_clubs
// existentes solo escribe lo que el formulario cambió respecto de lo que cargó.
// Los otros 3 casos de la reproducción de la Fase 0 (pisado A, aprobación borrada, admin
// con vista vieja) viven en concurrency.test.js con la API nueva (expected_version / seen).
afterEach(() => __setSupabaseClient(null))

const clubRow = (db, code = 5) => db.tables.event_clubs.find((row) => row.club_code === code)
const clubWrites = (db) => db.calls.filter((call) => call.table === 'event_clubs' && call.op !== 'select').length
// El editor guarda el formulario junto con el evento tal como lo cargó (loaded).
const editorSave = (loaded, patch = {}, activate = false) => saveEvent({ ...loaded, ...patch }, activate, loaded)
const withClub = (event, code, patch) => ({ ...event, clubs: event.clubs.map((club) => (Number(club.code) === code ? { ...club, ...patch } : club)) })

describe('C — reproducción de la Fase 0: pestaña vieja del editor', () => {
  it('editor abierto con el evento activo; el admin lo cierra desde el tablero; el editor guarda → NO debe reabrir', async () => {
    await seed()
    const staleForm = await getEvent('evt-1') // pestaña 1: editor abierto (status active)
    await updateEventStatus('evt-1', 'closed') // pestaña 2: tablero cierra inscripciones
    await editorSave(staleForm, { venue: 'Piscina nueva' }) // pestaña 1 guarda un detalle
    const event = await getEvent('evt-1')
    expect(event.status).toBe('closed')
    expect(event.venue).toBe('Piscina nueva')
  })

  it('PIN regenerado en el tablero; el editor viejo guarda → el PIN nuevo NO debe revertirse', async () => {
    const { db } = await seed()
    const staleForm = await getEvent('evt-1')
    const { pin: fresh } = await updateClubPin('evt-1', 5)
    await editorSave(staleForm, { venue: 'Piscina nueva' })
    expect(clubRow(db).pin).toBe(fresh)
  })

  it('el club ya envió (status submitted); el editor viejo guarda → NO debe volver a "invited"', async () => {
    const { db, token } = await seed()
    const staleForm = await getEvent('evt-1')
    await createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY }).submitInscription(payload(token, 1, 'X'))
    await editorSave(staleForm, { venue: 'Piscina nueva' })
    expect(clubRow(db).status).toBe('submitted')
  })

  it('sin `loaded` (llamada vieja) tampoco revierte status ni PIN de clubes existentes', async () => {
    const { db } = await seed()
    const staleForm = await getEvent('evt-1')
    await updateEventStatus('evt-1', 'closed')
    const { pin: fresh } = await updateClubPin('evt-1', 5)
    await saveEvent({ ...staleForm, venue: 'Piscina nueva' })
    expect((await getEvent('evt-1')).status).toBe('closed')
    expect(clubRow(db).pin).toBe(fresh)
  })
})

describe('6a — activar un borrador y reabrir siguen funcionando (vía updateEventStatus)', () => {
  it('"Guardar y activar" sobre un evento en draft lo activa, con opened_at, tokens y registro vía editor', async () => {
    const { db } = await seed()
    db.tables.events[0].status = 'draft'
    db.tables.tokens.length = 0
    const loaded = await getEvent('evt-1')
    const saved = await editorSave(loaded, { venue: 'Sede final' }, true)
    expect(saved).toMatchObject({ status: 'active', venue: 'Sede final' })
    expect(db.tables.events[0].opened_at).toBeTruthy()
    expect(db.tables.tokens.some((row) => row.club_code === 5)).toBe(true)
    expect(db.tables.audit_log).toContainEqual(expect.objectContaining({ action: 'event.activated', details: { from: 'draft', to: 'active', via: 'editor' } }))
  })

  it('"Guardar como borrador" sobre un draft lo deja en draft', async () => {
    const { db } = await seed()
    db.tables.events[0].status = 'draft'
    await editorSave(await getEvent('evt-1'), { venue: 'Otra' }, false)
    expect(db.tables.events[0].status).toBe('draft')
  })

  it('"Reabrir inscripciones" sobre un evento cerrado lo reabre', async () => {
    const { db } = await seed()
    await updateEventStatus('evt-1', 'closed')
    await editorSave(await getEvent('evt-1'), {}, true)
    expect(db.tables.events[0].status).toBe('active')
  })

  it('un evento NUEVO se crea con su estado (draft o activo) como antes', async () => {
    const { db } = await seed()
    const created = await saveEvent({ name: 'Nuevo', date_start: '2026-06-01', venue: 'X', status: 'draft', clubs: [{ code: 5, name: 'Club Cinco', pin: '4321' }], events: [] }, true)
    expect(created.status).toBe('active')
    expect(db.tables.event_clubs.find((row) => row.event_id === created.id)).toMatchObject({ status: 'invited', pin: '4321' })
    expect(db.tables.tokens.some((row) => row.event_id === created.id)).toBe(true)
  })
})

describe('6b — participación de clubes', () => {
  it('"No participa" desde el tablero; el editor viejo guarda → sigue sin participar', async () => {
    const { db } = await seed()
    const staleForm = await getEvent('evt-1')
    await setClubParticipation('evt-1', 5, false)
    await editorSave(staleForm, { venue: 'Otra' })
    expect(clubRow(db).status).toBe('not_participating')
  })

  it('"Reincorporar" desde el tablero; el editor viejo (que lo cargó sin participar) guarda → sigue reincorporado', async () => {
    const { db } = await seed()
    await setClubParticipation('evt-1', 5, false)
    const staleForm = await getEvent('evt-1')
    await setClubParticipation('evt-1', 5, true)
    await editorSave(staleForm, { venue: 'Otra' })
    expect(clubRow(db).status).toBe('invited')
  })

  it('el formulario cambia la participación (hacia o desde not_participating) → se escribe', async () => {
    const { db } = await seed()
    const loaded = await getEvent('evt-1')
    await saveEvent(withClub(loaded, 5, { participation_status: 'not_participating' }), false, loaded)
    expect(clubRow(db).status).toBe('not_participating')
    const excluded = await getEvent('evt-1')
    await saveEvent(withClub(excluded, 5, { participation_status: 'invited' }), false, excluded)
    expect(clubRow(db).status).toBe('invited')
  })

  it('un cambio de status que NO es de participación no se escribe desde el editor', async () => {
    const { db } = await seed()
    clubRow(db).status = 'submitted'
    const loaded = await getEvent('evt-1')
    await saveEvent(withClub(loaded, 5, { participation_status: 'invited' }), false, loaded)
    expect(clubRow(db).status).toBe('submitted')
  })
})

describe('6c — PIN editable a mano en el editor (EventEditor.jsx: input "PIN de acceso")', () => {
  it('el PIN cambiado en el formulario se escribe', async () => {
    const { db } = await seed()
    const loaded = await getEvent('evt-1')
    await saveEvent(withClub(loaded, 5, { pin: '8642' }), false, loaded)
    expect(clubRow(db).pin).toBe('8642')
  })

  it('los datos de contacto cambiados se escriben sin tocar status ni PIN', async () => {
    const { db } = await seed()
    const loaded = await getEvent('evt-1')
    const { pin: fresh } = await updateClubPin('evt-1', 5)
    clubRow(db).status = 'submitted'
    await saveEvent(withClub(loaded, 5, { contact_name: 'Ana', email: 'ana@club.com' }), false, loaded)
    expect(clubRow(db)).toMatchObject({ contact_name: 'Ana', email: 'ana@club.com', pin: fresh, status: 'submitted' })
  })
})

describe('pestaña vieja sin cambios', () => {
  it('no escribe status del evento ni nada en event_clubs (status, PIN, contacto)', async () => {
    const { db } = await seed()
    const staleForm = await getEvent('evt-1')
    await updateEventStatus('evt-1', 'accepting_late')
    const { pin: fresh } = await updateClubPin('evt-1', 5)
    clubRow(db).status = 'late_pending'
    const before = clubWrites(db)
    await editorSave(staleForm)
    expect(clubWrites(db)).toBe(before)
    expect(db.tables.events[0].status).toBe('accepting_late')
    expect(clubRow(db)).toMatchObject({ status: 'late_pending', pin: fresh })
  })
})
