// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — MEJORA #5: tardía ya revisada → "Nadadores nuevos para tardías" en solo lectura,
// con el estado de cada nadador. Club 5, PIN 1234, tardías T0 (5001), T1 (5002), T2 (5003).
const state = vi.hoisted(() => ({ wizard: null }))
vi.mock('../services/api', () => ({
  validateToken: (token, pin) => state.wizard.validateToken(token, { pin }),
  submitInscription: async () => ({ success: true })
}))

const { default: InscriptionWizard } = await import('./InscriptionWizard.jsx')
const { __setSupabaseClient, getDashboard, reviewLate } = await import('../services/supabaseStorage.js')
const { payload, seed } = await import('../services/testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('../services/wizardSupabase.js')
const { LATE_DECIDED_TEXT } = await import('../services/concurrency.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { mount, settle, unmountAll } = await import('../services/testSupport/dom.js')

let db, token
const decide = async (action, ids) => reviewLate('evt-1', 5, action, ids, (await getDashboard('evt-1')).late[0])
const openWizard = async () => {
  window.history.replaceState(null, '', `/inscribir?t=${encodeURIComponent(token)}`)
  sessionStorage.setItem(`swimtimer-pin:${token}`, '1234')
  await mount(<InscriptionWizard />)
  await settle()
}
const text = () => document.body.textContent
const lateSection = () => [...document.querySelectorAll('section')].find((section) => section.textContent.includes('Nadadores nuevos para tardías'))

beforeEach(async () => {
  ;({ db, token } = await seed())
  state.wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  db.tables.events[0].status = 'accepting_late'
  await state.wizard.submitInscription(payload(token, 3, 'T'))
  localStorage.clear()
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('entrenador — tardía revisada en solo lectura', () => {
  it('sin decisiones: la lista sigue editable y se puede agregar (control)', async () => {
    await openWizard()
    expect(lateSection().querySelector('[aria-label^="Editar a"]')).toBeTruthy()
    expect(text()).toContain('Registro manual')
    expect(text()).not.toContain(LATE_DECIDED_TEXT)
  })

  it('con decisiones: sin lápiz ni papelera, sin Registro manual/experto, cada nadador con su estado y el aviso arriba', async () => {
    await decide('approve', [5001])
    await decide('reject', [5002])
    await openWizard()
    const section = lateSection()
    expect(section.querySelector('[aria-label^="Editar a"]')).toBeNull()
    expect(section.querySelector('[aria-label^="Eliminar a"]')).toBeNull()
    expect(text()).not.toContain('Registro manual')
    expect(text()).not.toContain('Registro experto')
    expect(text()).not.toContain('Finalizar y enviar inscripción')
    const states = Object.fromEntries([...section.querySelectorAll('[data-decision]')].map((badge) => [badge.closest('div.flex').textContent.match(/T\d/)[0], badge.textContent]))
    expect(states).toEqual({ T0: 'Aprobado', T1: 'Rechazado', T2: 'Pendiente' })
    expect(text()).toContain(LATE_DECIDED_TEXT)
    expect(text().indexOf(LATE_DECIDED_TEXT)).toBeLessThan(text().indexOf('Nadadores nuevos para tardías'))
  })

  it('muestra la lista del SERVIDOR aunque el navegador tenga un borrador distinto', async () => {
    await openWizard() // guarda el borrador local con T0..T2
    await unmountAll()
    const key = Object.keys(localStorage).find((item) => item.includes('evt-1'))
    const draft = JSON.parse(localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify({ ...draft, roster: [...draft.roster, { ...draft.roster[0], id: 'local', lastName: 'SoloLocal' }] }))
    await decide('approve_pending', [])
    await openWizard()
    expect(lateSection().textContent).not.toContain('SoloLocal')
    expect(lateSection().querySelectorAll('[data-decision="approved"]')).toHaveLength(3)
  })
})
