// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — Revisión de tardías en el tablero real (AdminDashboard + fake de Supabase).
// Club 5 ("Club Cinco", CIN): tardías Nadador0 (5001), Nadador1 (5002), Nadador2 (5003).
const gate = vi.hoisted(() => ({ hold: null, fail: null }))
vi.mock('../services/api', async () => {
  const storage = await import('../services/supabaseStorage.js')
  const stub = async () => ({ success: true })
  return {
    ...storage,
    reviewLate: async (...args) => {
      if (gate.hold) await gate.hold
      if (gate.fail) throw gate.fail
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
  gate.fail = null
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
    expect(document.body.textContent).toContain('Queda 1 por revisar')
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

describe('BUG #3 — cada acción muestra su resultado y refresca la tarjeta', () => {
  const notice = () => document.querySelector('[data-notice]')
  const decideVia = async (name, trigger, yes) => {
    if (name) await choose(name)
    await click(button(trigger))
    await click(button(yes))
    await settle()
  }

  it('aprobar uno: "Aprobaste a 1 nadador de CIN" + cuántos quedan, y la tarjeta ya lo muestra aprobado', async () => {
    await openDashboard()
    await decideVia('Nadador0', 'Aprobar seleccionados', 'Sí, aprobar')
    expect(notice().dataset.notice).toBe('success')
    expect(notice().getAttribute('role')).toBe('status')
    expect(notice().textContent).toBe('Aprobaste a 1 nadador de CIN. Quedan 2 por revisar.')
    expect(document.querySelector('[data-decision="approved"]').textContent).toContain('Nadador0')
    expect(button('Aprobar pendientes (2)')).toBeTruthy()
  })

  it('rechazar dos: plural', async () => {
    await openDashboard()
    await choose('Nadador1')
    await decideVia('Nadador2', 'Rechazar seleccionados', 'Sí, rechazar')
    expect(notice().textContent).toBe('Rechazaste a 2 nadadores de CIN. Queda 1 por revisar.')
  })

  it('la última decisión cierra la tardía: la tarjeta sale y el resultado sigue visible', async () => {
    await openDashboard()
    await decideVia(null, 'Aprobar pendientes (3)', 'Sí, aprobar')
    expect(notice().textContent).toBe('Aprobaste a los 3 nadadores pendientes de CIN. La tardía de CIN quedó revisada.')
    expect(document.body.textContent).toContain('No quedan tardías por revisar.')
    expect(button('Club Cinco')).toBeUndefined()
  })

  it('un fallo que no es conflicto se muestra en rojo (no queda en una promesa sin manejar) y no escribe', async () => {
    gate.fail = new Error('Sin conexión con el servidor')
    await openDashboard()
    await decideVia('Nadador0', 'Aprobar seleccionados', 'Sí, aprobar')
    expect(notice().dataset.notice).toBe('error')
    expect(notice().getAttribute('role')).toBe('alert')
    expect(notice().textContent).toBe('Sin conexión con el servidor')
    expect(lateWrites()).toBe(0)
    expect(button('Aprobar pendientes (3)').disabled).toBe(false)
  })

  it('el éxito siguiente reemplaza al error', async () => {
    gate.fail = new Error('Sin conexión con el servidor')
    await openDashboard()
    await decideVia('Nadador0', 'Aprobar seleccionados', 'Sí, aprobar')
    gate.fail = null
    await decideVia('Nadador0', 'Aprobar seleccionados', 'Sí, aprobar')
    expect(notice().dataset.notice).toBe('success')
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(1)
  })
})

describe('MEJORA #4 — aviso de conflicto del admin', () => {
  const CONFLICT = 'La inscripción tardía de CIN cambió mientras la revisabas. Ya cargamos la versión actual: revísala y vuelve a aprobar o rechazar.'
  const notice = () => document.querySelector('[data-notice]')
  let scrolled
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this)
    }
  })
  const conflictOn = async (otherTab) => {
    await openDashboard()
    await choose('Nadador0')
    await otherTab()
    await click(button('Aprobar seleccionados'))
    await click(button('Sí, aprobar'))
    await settle()
  }

  it('rojo fuerte dentro de la tarjeta, texto veraz con el club, scroll y foco; sin el banner genérico', async () => {
    await conflictOn(async () => reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0]))
    expect(notice().dataset.notice).toBe('conflict')
    expect(notice().textContent).toBe(CONFLICT)
    expect(notice().className).toContain('bg-danger-solid')
    expect(notice().getAttribute('role')).toBe('alert')
    expect(notice().closest('section').textContent).toContain('Inscripciones tardías pendientes')
    expect(scrolled).toContain(notice())
    expect(document.activeElement).toBe(notice())
    expect(document.body.textContent).not.toContain('Recarga para ver la versión actual')
  })

  it('se ve aunque otra pestaña ya haya decidido toda la tardía (la tarjeta del club ya no está)', async () => {
    await conflictOn(async () => reviewLate('evt-1', 5, 'approve_pending', [], (await getDashboard('evt-1')).late[0]))
    expect(notice().textContent).toBe(CONFLICT)
    expect(button('Club Cinco')).toBeUndefined()
  })

  it('un segundo conflicto vuelve a hacer scroll y foco', async () => {
    await conflictOn(async () => reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0]))
    const first = notice()
    await reviewLate('evt-1', 5, 'reject', [5003], (await getDashboard('evt-1')).late[0])
    await choose('Nadador0')
    await click(button('Aprobar seleccionados'))
    await click(button('Sí, aprobar'))
    await settle()
    expect(notice()).not.toBe(first)
    expect(scrolled).toHaveLength(2)
    expect(document.activeElement).toBe(notice())
  })

  it('se oculta cuando la acción siguiente sale bien', async () => {
    await conflictOn(async () => reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0]))
    await choose('Nadador0')
    await click(button('Aprobar seleccionados'))
    await click(button('Sí, aprobar'))
    await settle()
    expect(notice().dataset.notice).toBe('success')
    expect(document.body.textContent).not.toContain('cambió mientras la revisabas')
  })
})

describe('tardías revisadas siguen visibles en "Ver inscripciones"', () => {
  const decideAll = async (approve, reject) => {
    if (approve.length) await reviewLate('evt-1', 5, 'approve', approve, (await getDashboard('evt-1')).late[0])
    if (reject.length) await reviewLate('evt-1', 5, 'reject', reject, (await getDashboard('evt-1')).late[0])
  }
  const openDetail = async () => {
    await mount(<AdminDashboard eventId="evt-1" />)
    await settle()
    await click(button('Ver inscripciones'))
    await settle()
  }
  const states = () => Object.fromEntries([...document.querySelectorAll('[data-decision]')].map((row) => [row.textContent.match(/T\d/)[0], row.dataset.decision]))

  it('T14: una tardía mixta decidida sale de pendientes y aparece en revisadas con los dos estados', async () => {
    await decideAll([5001, 5003], [5002])
    await openDetail()
    expect(document.body.textContent).not.toContain('Inscripciones tardías pendientes')
    expect(document.body.textContent).toContain('Tardías revisadas')
    expect(states()).toEqual({ T0: 'approved', T1: 'rejected', T2: 'approved' })
    expect(document.querySelector('[data-decision="rejected"]').textContent).toContain('Rechazado')
    expect(document.querySelector('[data-decision="approved"]').textContent).toContain('Aprobado')
  })

  it('club solo con tardía y todos rechazados: el botón aparece y ningún rechazado desaparece', async () => {
    await decideAll([], [5001, 5002, 5003])
    await openDetail()
    expect(states()).toEqual({ T0: 'rejected', T1: 'rejected', T2: 'rejected' })
  })

  it('revisión en curso: los pendientes se ven como "Pendiente"', async () => {
    await decideAll([5001], [])
    await openDetail()
    expect(states()).toEqual({ T0: 'approved', T1: 'pending', T2: 'pending' })
    expect(document.querySelector('[data-decision="pending"]').textContent).toContain('Pendiente')
  })
})
