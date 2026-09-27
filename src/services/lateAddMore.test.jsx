// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.22.0 — Agregar nadadores a una tardía ya revisada. Con alguna decisión, los ya enviados
// quedan fijos (mismo contenido y orden: los Ath_no son posicionales) y solo se agregan
// nuevos al final. Club 5: tardíos 5001, 5002, 5003…
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: saveHandler } = await import('../../api/save-draft.js')
const { __setSupabaseClient, exportConsolidated, getDashboard, reviewLate } = await import('./supabaseStorage.js')
const { payload, rosterSet, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { LATE_FIXED_CHANGED_TEXT, LATE_NOTHING_NEW_TEXT } = await import('./concurrency.js')
const { LateResubmissionError, canAddToReviewedLate, lateFixedCount, mergeLateResubmission, needsReview, pendingAthletes } = await import('./lateDecision.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { default: LateReviewPanel } = await import('../components/LateReviewPanel.jsx')
const { mount, unmountAll } = await import('./testSupport/dom.js')

let db, token, wizard
const lateRow = () => db.tables.inscriptions.find((row) => row.is_late)
const seenLate = async () => (await getDashboard('evt-1')).late.find((item) => Number(item.club.code) === 5)
const review = async (action, ids = []) => reviewLate('evt-1', 5, action, ids, await seenLate())
const clubStatus = () => db.tables.event_clubs.find((row) => row.club_code === 5).status
const lateNumbers = (output) => Object.fromEntries(output.athletes.filter((athlete) => athlete.late).map((athlete) => [athlete.Last_name, athlete.Ath_no]))

beforeEach(async () => {
  ;({ db, token } = await seed())
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  mocks.client = { from: db.from }
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  db.tables.events[0].status = 'accepting_late'
  await wizard.submitInscription(payload(token, 3, 'T'))
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('secuencia real: 3 tardíos → aprueba 1 y rechaza 1 → el entrenador agrega 2', () => {
  it('el admin ve 3 pendientes marcables, los decididos intactos, y el consolidado conserva los números', async () => {
    await review('approve', [5001])
    await review('reject', [5002])
    const before = await exportConsolidated('evt-1', 'supplement')
    expect(lateNumbers(before)).toEqual({ Nadador0: expect.any(Number) })

    await expect(wizard.submitInscription(payload(token, 5, 'T'))).resolves.toMatchObject({ success: true, late: true, version: 4 })
    const row = lateRow()
    expect(row.roster.map((athlete) => athlete.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4'])
    expect(row.athletes.map((athlete) => athlete.Ath_no)).toEqual([5001, 5002, 5003, 5004, 5005])
    expect(row).toMatchObject({ approved_athletes: [5001], rejected_athletes: [5002], late_status: 'partially_approved' })
    expect(clubStatus()).toBe('late_pending')

    const seen = await seenLate()
    expect(needsReview(seen)).toBe(true)
    expect(pendingAthletes(seen).map((athlete) => athlete.Ath_no)).toEqual([5003, 5004, 5005])
    expect((await getDashboard('evt-1')).counts.late_pending).toBe(1)

    // Panel del admin: 3 casillas (1 viejo + 2 nuevos) y los decididos sin casilla.
    const view = await mount(<LateReviewPanel submissions={[seen]} onReview={() => {}} busy={false} notice={null} />)
    await act(async () => view.host.querySelector('button').click())
    expect(view.host.querySelectorAll('input[type="checkbox"]')).toHaveLength(3)
    expect([...view.host.querySelectorAll('[data-decision]')].map((node) => node.dataset.decision)).toEqual(['approved', 'rejected'])

    // Consolidado: el aprobado conserva su número; aprobar a un nuevo no lo mueve.
    const after = await exportConsolidated('evt-1', 'supplement')
    expect(lateNumbers(after)).toEqual(lateNumbers(before))
    await review('approve', [5005])
    const approvedNew = await exportConsolidated('evt-1', 'supplement')
    expect(lateNumbers(approvedNew).Nadador0).toBe(lateNumbers(before).Nadador0)
    expect(Object.keys(lateNumbers(approvedNew))).toEqual(['Nadador0', 'Nadador4'])
  })
})

describe('el servidor toma los fijos tal como están guardados', () => {
  beforeEach(async () => {
    await review('approve', [5001])
  })

  it('aunque el cliente mande otros datos derivados de un fijo (p. ej. la edad), se guarda el original', async () => {
    const body = payload(token, 4, 'T')
    const athletes = body.athletes.map((athlete) => (athlete.Ath_no === 5001 ? { ...athlete, Ath_age: 99, Last_name: 'CAMBIADO' } : athlete))
    await wizard.submitInscription({ ...body, athletes, expected_version: 2 })
    expect(lateRow().athletes[0]).toMatchObject({ Ath_no: 5001, Ath_age: 12, Last_name: 'Nadador0' })
    expect(lateRow().results.filter((result) => result.Ath_no === 5001)).toHaveLength(1)
  })

  it.each([
    ['cambiar un fijo', () => ({ ...payload(token, 4, 'T'), roster: [rosterSet(1, 'X')[0], ...rosterSet(4, 'T').slice(1)] })],
    ['borrar un fijo', () => ({ ...payload(token, 3, 'T'), roster: rosterSet(4, 'T').filter((athlete) => athlete.id !== 'T1') })],
    ['mover los fijos', () => ({ ...payload(token, 4, 'T'), roster: [...rosterSet(3, 'T').reverse(), ...rosterSet(4, 'T').slice(3)] })],
    ['nuevo con un Ath_no que no sigue a los fijos', () => ({ ...payload(token, 4, 'T'), athletes: payload(token, 4, 'T').athletes.map((athlete) => (athlete.Ath_no === 5004 ? { ...athlete, Ath_no: 5009 } : athlete)) })]
  ])('%s → 409 lateFixedChanged, nada cambia', async (_name, body) => {
    const before = structuredClone(lateRow())
    await expect(wizard.submitInscription(body())).rejects.toMatchObject({ status: 409, message: LATE_FIXED_CHANGED_TEXT, details: { lateFixedChanged: true } })
    expect(lateRow()).toEqual(before)
  })

  it('sin nadadores nuevos → 409 lateNothingNew', async () => {
    await expect(wizard.submitInscription(payload(token, 3, 'T'))).rejects.toMatchObject({ status: 409, message: LATE_NOTHING_NEW_TEXT, details: { lateNothingNew: true } })
  })
})

describe('borrador (v1.21.0) con la misma regla', () => {
  const call = async (body) => {
    const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this }, json(value) { this.body = value; return this } }
    await saveHandler({ method: 'POST', body, headers: { 'x-forwarded-for': '1.1.1.1' } }, res)
    return res
  }
  const draft = (roster) => ({ token, pin: '1234', roster, base_version: lateRow().version, expected_rev: 0 })

  it('fijos + nuevos se guarda; fijos alterados → 409 lateFixedChanged', async () => {
    await review('reject', [5002])
    expect((await call(draft(rosterSet(4, 'T')))).body).toEqual({ saved: true, rev: 1 })
    const bad = await call({ ...draft([...rosterSet(2, 'T'), ...rosterSet(2, 'Z')]), expected_rev: 1 })
    expect(bad.statusCode).toBe(409)
    expect(bad.body).toMatchObject({ lateFixedChanged: true, error: LATE_FIXED_CHANGED_TEXT })
    expect(db.tables.inscription_drafts[0].rev).toBe(1)
  })
})

describe('reglas puras', () => {
  const stored = { athletes: [{ Ath_no: 5001 }, { Ath_no: 5002 }], results: [{ Ath_no: 5001 }], roster: rosterSet(2, 'T'), approved_athletes: [5001], rejected_athletes: [], status: 'partially_approved' }

  it('cuántos fijos y cuándo se puede agregar', () => {
    expect(lateFixedCount(stored)).toBe(2)
    expect(lateFixedCount({ ...stored, approved_athletes: [] , status: 'pending' })).toBe(0)
    expect(canAddToReviewedLate({ ...stored, approved_athletes: [], status: 'approved' })).toBe(false) // fila vieja
    expect(canAddToReviewedLate({ ...stored, roster: [] })).toBe(false) // sin la lista del entrenador
  })

  it('merge: fijos guardados + nuevos del envío; decisiones intactas; estado recalculado', () => {
    const merged = mergeLateResubmission(stored, { roster: rosterSet(3, 'T'), athletes: [{ Ath_no: 5001, Last_name: 'X' }, { Ath_no: 5003 }], results: [{ Ath_no: 5003 }] }, 5)
    expect(merged.athletes).toEqual([{ Ath_no: 5001 }, { Ath_no: 5002 }, { Ath_no: 5003 }])
    expect(merged.results).toEqual([{ Ath_no: 5001 }, { Ath_no: 5003 }])
    expect(merged).toMatchObject({ approved_athletes: [5001], rejected_athletes: [], late_status: 'partially_approved' })
    expect(() => mergeLateResubmission(stored, { roster: rosterSet(2, 'T'), athletes: [], results: [] }, 5)).toThrow(LateResubmissionError)
  })
})
