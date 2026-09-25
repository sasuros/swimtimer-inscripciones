// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — Revisión de tardías en el tablero real (AdminDashboard + fake de Supabase).
// Club 5 ("Club Cinco", CIN): tardías Nadador0 (5001), Nadador1 (5002), Nadador2 (5003).
const gate = vi.hoisted(() => ({ hold: null }))
vi.mock('../services/api', async () => {
  const storage = await import('../services/supabaseStorage.js')
  const stub = async () => ({ success: true })
  return {
    ...storage,
    reviewLate: async (...args) => {
      if (gate.hold) await gate.hold
      return storage.reviewLate(...args)
    },
    generateEmailInvitations: stub,
    recordInvitationResults: stub,
    revokeMagicInvitation: stub,
    sendInvitationEmails: stub,
    updateLandingSettings: stub
  }
})

const { default: AdminDashboard } = await import('../pages/AdminDashboard.jsx')
const { default: LateReviewPanel } = await import('./LateReviewPanel.jsx')
const { __setSupabaseClient, getDashboard, reviewLate } = await import('../services/supabaseStorage.js')
const { payload, seed } = await import('../services/testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('../services/wizardSupabase.js')
const { DEMO_ADMIN_PASSWORD } = await import('../config.js')
const { button, checkbox, click, dialog, mount, settle, unmountAll } = await import('../services/testSupport/dom.js')

let db, token, wizard
const lateRow = () => db.tables.inscriptions.find((row) => row.is_late)
const lateWrites = () => db.calls.filter((item) => item.table === 'inscriptions' && item.op === 'update').length
const openDashboard = async () => {
  await mount(<AdminDashboard eventId="evt-1" />)
  await settle()
  await click(button('Club Cinco'))
}
const choose = (name) => click(checkbox(name))

beforeEach(async () => {
  ;({ db, token } = await seed())
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: DEMO_ADMIN_PASSWORD })
  db.tables.events[0].status = 'accepting_late'
  await wizard.submitInscription(payload(token, 3, 'T'))
  gate.hold = null
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('diálogo de confirmación', () => {
  it('nombra a los nadadores y al club; aprobar escribe solo tras "Sí, aprobar"', async () => {
    await openDashboard()
    await choose('Nadador0')
    await click(button('Aprobar seleccionados'))
    expect(dialog().textContent).toContain('¿Aprobar a X Nadador0 (CIN)? Esta decisión no se puede cambiar después.')
    expect(lateWrites()).toBe(0)
    await click(button('Sí, aprobar'))
    await settle()
    expect(lateRow()).toMatchObject({ approved_athletes: [5001], rejected_athletes: [] })
  })

  it('T13: cancelar el diálogo no escribe nada', async () => {
    await openDashboard()
    await choose('Nadador1')
    await click(button('Rechazar seleccionados'))
    expect(dialog().textContent).toContain('¿Rechazar a X Nadador1 (CIN)? Esta decisión no se puede cambiar después.')
    const before = structuredClone(lateRow())
    await click(button('Cancelar'))
    await settle()
    expect(dialog()).toBeNull()
    expect(lateWrites()).toBe(0)
    expect(lateRow()).toEqual(before)
  })

  it('"Aprobar pendientes" lista los nombres (≤5) y no incluye a los ya decididos', async () => {
    await reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0])
    await openDashboard()
    await click(button('Aprobar pendientes (2)'))
    expect(dialog().textContent).toContain('¿Aprobar a X Nadador0 y X Nadador2 (CIN)?')
  })

  it('con más de 5 pendientes muestra el conteo', async () => {
    await unmountAll()
    ;({ db, token } = await seed())
    db.tables.events[0].status = 'accepting_late'
    wizard = createSupabaseWizardStorage({ client: db, adminPassword: DEMO_ADMIN_PASSWORD })
    await wizard.submitInscription(payload(token, 7, 'T'))
    await openDashboard()
    await click(button('Aprobar pendientes (7)'))
    expect(dialog().textContent).toContain('¿Aprobar a los 7 nadadores pendientes (CIN)? Esta decisión no se puede cambiar después.')
  })

  it('"Rechazar seleccionados" es rojo y va separado de los botones de aprobar', async () => {
    await openDashboard()
    const reject = button('Rechazar seleccionados')
    expect(reject.className).toContain('btn-danger')
    expect(reject.parentElement.className).toContain('ml-auto')
    expect(reject.parentElement.contains(button('Aprobar seleccionados'))).toBe(false)
  })
})

describe('decididos, selección y doble clic', () => {
  it('los ya decididos se ven con su estado y sin checkbox', async () => {
    const seen = (await getDashboard('evt-1')).late[0]
    await reviewLate('evt-1', 5, 'approve', [5001], seen)
    await reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0])
    await openDashboard()
    expect(checkbox('Nadador0')).toBeUndefined()
    expect(checkbox('Nadador1')).toBeUndefined()
    expect(checkbox('Nadador2')).toBeTruthy()
    expect(document.querySelector('[data-decision="approved"]').textContent).toContain('Aprobado')
    expect(document.querySelector('[data-decision="rejected"]').textContent).toContain('Rechazado')
    expect(document.body.textContent).toContain('Quedan 1 por revisar')
  })

  it('una carga nueva (otra versión) vacía la selección: los Ath_no viejos no viajan', async () => {
    const first = (await getDashboard('evt-1')).late[0]
    const onReview = vi.fn()
    const { rerender } = await mount(<LateReviewPanel submissions={[first]} onReview={onReview} />)
    await click(button('Club Cinco'))
    await choose('Nadador0')
    expect(checkbox('Nadador0').checked).toBe(true)
    await rerender(<LateReviewPanel submissions={[{ ...first, version: first.version + 1 }]} onReview={onReview} />)
    expect(checkbox('Nadador0').checked).toBe(false)
    expect(button('Aprobar seleccionados').disabled).toBe(true)
  })

  it('tras un conflicto, la acción siguiente usa la versión y los IDs de la carga NUEVA', async () => {
    await openDashboard()
    await choose('Nadador0')
    // Otra pestaña del admin decide a Nadador1 después de esta carga.
    await reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0])
    await click(button('Aprobar seleccionados'))
    await click(button('Sí, aprobar'))
    await settle()
    expect(lateRow()).toMatchObject({ approved_athletes: [], rejected_athletes: [5002], version: 2 })
    expect(checkbox('Nadador0').checked).toBe(false)
    expect(checkbox('Nadador1')).toBeUndefined()
    await choose('Nadador0')
    await click(button('Aprobar seleccionados'))
    await click(button('Sí, aprobar'))
    await settle()
    expect(lateRow()).toMatchObject({ approved_athletes: [5001], rejected_athletes: [5002], version: 3 })
  })

  it('sin doble clic: con una revisión en vuelo los botones se deshabilitan y un segundo envío no escribe', async () => {
    let release
    gate.hold = new Promise((resolve) => (release = resolve))
    await openDashboard()
    await choose('Nadador0')
    await click(button('Aprobar seleccionados'))
    const yes = button('Sí, aprobar')
    await click(yes)
    await click(yes) // el nodo ya salió del DOM: no hace nada
    expect(button('Aprobar pendientes').disabled).toBe(true)
    expect(checkbox('Nadador1').disabled).toBe(true)
    await click(button('Aprobar pendientes'))
    expect(dialog()).toBeNull()
    release()
    await settle()
    expect(lateWrites()).toBe(1)
    expect(lateRow()).toMatchObject({ approved_athletes: [5001], version: 2 })
    expect(button('Aprobar pendientes').disabled).toBe(false)
  })
})
