import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — Semántica de la revisión de tardías (plan aprobado, opción A: decisión final).
// Club 5, tardías A=5001, B=5002, C=5003 (T1/T2 con dos: A y B).
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { __setSupabaseClient, getDashboard, reviewLate } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { LATE_DECIDED_TEXT } = await import('./concurrency.js')
const { applyLateDecision, lateStatusFor, needsReview } = await import('./lateDecision.js')
const { DEMO_ADMIN_PASSWORD } = await import('../config.js')

const [A, B, C] = [5001, 5002, 5003]
let db, token, wizard
const lateRow = () => db.tables.inscriptions.find((row) => row.is_late)
const board = () => getDashboard('evt-1')
const seenLate = async () => (await board()).late.find((item) => Number(item.club.code) === 5)
const review = async (action, ids = []) => reviewLate('evt-1', 5, action, ids, await seenLate())
const decide = (approved, rejected) => Object.assign(lateRow(), { approved_athletes: approved, rejected_athletes: rejected, late_status: lateStatusFor(lateRow().athletes.length, approved.length, rejected.length) })
const inPanel = async () => (await board()).counts.late_pending === 1
const unchanged = async (action, ids) => {
  const before = structuredClone(lateRow())
  await expect(review(action, ids)).rejects.toMatchObject({ status: 422 })
  expect(lateRow()).toEqual(before)
}

const setup = async (n) => {
  ;({ db, token } = await seed())
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: DEMO_ADMIN_PASSWORD })
  mocks.client = { from: db.from }
  db.tables.events[0].status = 'accepting_late'
  await wizard.submitInscription(payload(token, n, 'T'))
}
afterEach(() => __setSupabaseClient(null))

describe('tabla de decisiones — 2 nadadores', () => {
  beforeEach(() => setup(2))

  it('T1: aprobar [A] → ap=[A], partially_approved, sigue en el panel', async () => {
    await review('approve', [A])
    expect(lateRow()).toMatchObject({ approved_athletes: [A], rejected_athletes: [], late_status: 'partially_approved', version: 2 })
    expect(await inPanel()).toBe(true)
  })

  it('T2: ap=[A] + rechazar [B] → mixta completa: partially_approved y SALE del panel', async () => {
    await review('approve', [A])
    await review('reject', [B])
    expect(lateRow()).toMatchObject({ approved_athletes: [A], rejected_athletes: [B], late_status: 'partially_approved' })
    expect((await board()).counts.late_pending).toBe(0)
    expect(needsReview(await seenLate())).toBe(false)
  })

  it('T11: secuencia del preview (aprobar A → rechazar B → rechazar A) → el 3.º se frena y queda ap=[A] rej=[B]', async () => {
    await review('approve', [A])
    await review('reject', [B])
    await unchanged('reject', [A])
    expect(lateRow()).toMatchObject({ approved_athletes: [A], rejected_athletes: [B], late_status: 'partially_approved', version: 3 })
  })
})

describe('tabla de decisiones — 3 nadadores', () => {
  beforeEach(() => setup(3))

  it('T3: rechazar [B] → no toca a A ni a C (siguen pendientes)', async () => {
    await review('reject', [B])
    expect(lateRow()).toMatchObject({ approved_athletes: [], rejected_athletes: [B], late_status: 'partially_approved' })
    expect(await inPanel()).toBe(true)
  })

  it('T4: aprobar pendientes → ap=[A,B,C], approved, club late_approved', async () => {
    await review('approve_pending')
    expect(lateRow()).toMatchObject({ approved_athletes: [A, B, C], rejected_athletes: [], late_status: 'approved' })
    expect(db.tables.event_clubs.find((row) => row.club_code === 5).status).toBe('late_approved')
    expect(await inPanel()).toBe(false)
  })

  it('T5: rej=[B] + aprobar pendientes → aprueba solo A y C; B sigue rechazado; sale del panel', async () => {
    await review('reject', [B])
    await review('approve_pending')
    expect(lateRow()).toMatchObject({ approved_athletes: [A, C], rejected_athletes: [B], late_status: 'partially_approved' })
    expect(await inPanel()).toBe(false)
    expect(db.tables.event_clubs.find((row) => row.club_code === 5).status).not.toBe('late_approved')
  })

  it('T6: rechazar [A,B,C] → rejected, sale del panel', async () => {
    await review('reject', [A, B, C])
    expect(lateRow()).toMatchObject({ approved_athletes: [], rejected_athletes: [A, B, C], late_status: 'rejected' })
    expect(await inPanel()).toBe(false)
  })

  it('T7: ap=[A] + rechazar [A] → error, no escribe', async () => {
    await review('approve', [A])
    await unchanged('reject', [A])
  })

  it('T7b: ap=[A] + rechazar [A,B] → error, tampoco rechaza a B (todo o nada)', async () => {
    await review('approve', [A])
    await unchanged('reject', [A, B])
  })

  it('T8: rej=[B] + aprobar [B] → error, no escribe', async () => {
    await review('reject', [B])
    await unchanged('approve', [B])
  })

  it('T9: vista vieja (versión distinta) → 409, no escribe', async () => {
    const seen = await seenLate()
    await review('approve', [A])
    const before = structuredClone(lateRow())
    await expect(reviewLate('evt-1', 5, 'reject', [B], seen)).rejects.toMatchObject({ status: 409 })
    expect(lateRow()).toEqual(before)
  })

  it('T10: ap=[A] → el entrenador ya no puede re-enviar (D1)', async () => {
    await review('approve', [A])
    await expect(wizard.submitInscription(payload(token, 3, 'OTRO'))).rejects.toMatchObject({ status: 409, message: LATE_DECIDED_TEXT })
    expect(lateRow()).toMatchObject({ approved_athletes: [A] })
  })

  it('T12: ids vacíos, ids inexistentes, acción desconocida o sin pendientes → error, no escribe', async () => {
    await unchanged('approve', [])
    await unchanged('reject', [9999])
    await unchanged('approve', [A, 9999])
    await unchanged('approve_all', [])
    decide([A, B], [C])
    await unchanged('approve_pending')
  })

  it('duplicados en la selección cuentan una vez', async () => {
    await review('approve', [A, A])
    expect(lateRow().approved_athletes).toEqual([A])
  })
})

describe('lateStatusFor / needsReview (puras)', () => {
  it.each([
    [3, 0, 0, 'pending'],
    [3, 1, 0, 'partially_approved'],
    [3, 0, 1, 'partially_approved'],
    [3, 2, 1, 'partially_approved'],
    [3, 3, 0, 'approved'],
    [3, 0, 3, 'rejected'],
    [1, 1, 0, 'approved'],
    [1, 0, 1, 'rejected']
  ])('%i nadadores, %i aprobados, %i rechazados → %s', (total, ap, rej, status) => {
    expect(lateStatusFor(total, ap, rej)).toBe(status)
  })

  const late = (status, approved, rejected) => ({ status, athletes: [{ Ath_no: A }, { Ath_no: B }], approved_athletes: approved, rejected_athletes: rejected })
  it.each([
    ['pending', [], [], true],
    ['partially_approved', [A], [], true],
    ['partially_approved', [A], [B], false],
    ['approved', [A, B], [], false],
    ['rejected', [], [A, B], false],
    ['approved', [], [], false] // fila vieja cerrada: no vuelve al panel
  ])('status %s, ap=%j, rej=%j → necesita revisión: %s', (status, ap, rej, expected) => {
    expect(needsReview(late(status, ap, rej))).toBe(expected)
  })

  it('los Ath_no en texto se comparan como números', () => {
    const decision = applyLateDecision({ athletes: [{ Ath_no: '5001' }, { Ath_no: '5002' }], approved_athletes: ['5001'], rejected_athletes: [] }, 'reject', ['5002'])
    expect(decision).toMatchObject({ approved_athletes: [A], rejected_athletes: [B], status: 'partially_approved' })
    expect(() => applyLateDecision({ athletes: [{ Ath_no: '5001' }], approved_athletes: ['5001'] }, 'reject', [5001])).toThrow(/no se pueden cambiar/)
  })
})

describe('audit late.reviewed (commit 6): club, conteos, versión y resultado; sin nombres', () => {
  beforeEach(() => setup(3))
  const reviewed = () => db.tables.audit_log.filter((row) => row.action === 'late.reviewed')

  it('éxito: conteos de esta decisión y la versión nueva', async () => {
    await review('reject', [B, C])
    expect(reviewed()).toEqual([expect.objectContaining({ action: 'late.reviewed', event_id: 'evt-1', club_code: 5, outcome: 'success', details: { approved: 0, rejected: 2, version: 2 } })])
    await review('approve_pending')
    expect(reviewed()[1]).toMatchObject({ outcome: 'success', details: { approved: 1, rejected: 0, version: 3 } })
  })

  it('conflicto (409) y decisión ya tomada (422): failure con la versión sobre la que se intentó', async () => {
    const stale = await seenLate()
    await review('approve', [A])
    await expect(reviewLate('evt-1', 5, 'reject', [B], stale)).rejects.toMatchObject({ status: 409 })
    await expect(review('reject', [A])).rejects.toMatchObject({ status: 422 })
    expect(reviewed().map((row) => [row.outcome, row.details])).toEqual([
      ['success', { approved: 1, rejected: 0, version: 2 }],
      ['failure', { approved: 0, rejected: 1, version: 1 }],
      ['failure', { approved: 0, rejected: 1, version: 2 }]
    ])
  })

  it('sin vista (llamada vieja): failure sin versión', async () => {
    await expect(reviewLate('evt-1', 5, 'approve', [A])).rejects.toMatchObject({ status: 409 })
    expect(reviewed()).toEqual([expect.objectContaining({ outcome: 'failure', details: { approved: 1, rejected: 0 } })])
  })

  it('ningún nombre ni Ath_no viaja al audit', async () => {
    await review('approve', [A, B])
    const json = JSON.stringify(reviewed())
    expect(json).not.toMatch(/Nadador|5001|5002|"X"/)
    expect(Object.keys(reviewed()[0].details).sort()).toEqual(['approved', 'rejected', 'version'])
  })
})

describe('D1 por decisiones, no solo por status (revisión adversarial #1)', () => {
  beforeEach(() => setup(2))

  it('fila sucia/vieja: late_status pending con decisiones → el entrenador tampoco puede re-enviar', async () => {
    Object.assign(lateRow(), { late_status: 'pending', approved_athletes: [A], rejected_athletes: [B] })
    await expect(wizard.submitInscription(payload(token, 2, 'OTRO'))).rejects.toMatchObject({ status: 409, message: LATE_DECIDED_TEXT })
    expect(lateRow()).toMatchObject({ approved_athletes: [A], rejected_athletes: [B] })
  })
})
