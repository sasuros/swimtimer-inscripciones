// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — MEJORA #5: tardía ya revisada → la lista del servidor con el estado de cada nadador.
// v1.22.0 — Con decisiones, los ya enviados quedan fijos y se pueden agregar nuevos al final.
// Club 5, PIN 1234, tardías T0 (5001), T1 (5002), T2 (5003).
const state = vi.hoisted(() => ({ wizard: null, submitted: [], saveDraft: null }))
vi.mock('../services/api', () => ({
  validateToken: (token, pin) => state.wizard.validateToken(token, { pin }),
  submitInscription: async (body) => {
    state.submitted.push(body)
    return { success: true }
  },
  saveDraft: (...args) => state.saveDraft(...args)
}))

// Sin Supabase en los tests la app estaría en modo demo (sin guardado del borrador en línea).
vi.mock('../config', async (original) => ({ ...(await original()), DEMO_MODE: false }))

const { default: InscriptionWizard } = await import('./InscriptionWizard.jsx')
const { __setSupabaseClient, getDashboard, reviewLate } = await import('../services/supabaseStorage.js')
const { payload, seed } = await import('../services/testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('../services/wizardSupabase.js')
const { LATE_ADD_MORE_TEXT, LATE_DECIDED_TEXT, LATE_FIXED_CHANGED_TEXT } = await import('../services/concurrency.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { button, mount, settle, unmountAll } = await import('../services/testSupport/dom.js')

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
const sectionTitled = (title) => [...document.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === title)
const paste = async (value) => {
  const textarea = document.querySelector('#quick-entry')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  await act(async () => {
    setter.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('Validar filas').click())
  await act(async () => button('Importar').click())
  await settle()
}
const NEW_ROW = 'Nueva | Eva | F | 15/05/2016 | 50m Libre | 32.56'

beforeEach(async () => {
  ;({ db, token } = await seed())
  db.tables.event_events.push({ event_id: 'evt-1', event_ptr: 1, distance: 50, style: 'Libre', age_lo: 8, age_hi: 12, sex: 'F', active: true })
  state.wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  state.submitted = []
  state.saveDraft = async () => ({ saved: true, rev: 1 })
  db.tables.events[0].status = 'accepting_late'
  await state.wizard.submitInscription(payload(token, 3, 'T'))
  localStorage.clear()
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('entrenador — tardía revisada', () => {
  it('sin decisiones: la lista sigue editable y se puede agregar (control)', async () => {
    await openWizard()
    expect(lateSection().querySelector('[aria-label^="Editar a"]')).toBeTruthy()
    expect(text()).toContain('Registro manual')
    expect(text()).not.toContain(LATE_DECIDED_TEXT)
    expect(text()).not.toContain(LATE_ADD_MORE_TEXT)
  })

  it('con decisiones: los enviados fijos con su estado, el aviso nuevo arriba y los métodos para agregar', async () => {
    await decide('approve', [5001])
    await decide('reject', [5002])
    await openWizard()
    const fixed = sectionTitled('Nadadores tardíos ya enviados')
    expect(fixed.querySelector('[aria-label^="Editar a"]')).toBeNull()
    expect(fixed.querySelector('[aria-label^="Eliminar a"]')).toBeNull()
    const states = Object.fromEntries([...fixed.querySelectorAll('[data-decision]')].map((badge) => [badge.closest('div.flex').textContent.match(/T\d/)[0], badge.textContent]))
    expect(states).toEqual({ T0: 'Aprobado', T1: 'Rechazado', T2: 'Pendiente' })
    expect(text()).toContain(LATE_ADD_MORE_TEXT)
    expect(text()).not.toContain(LATE_DECIDED_TEXT)
    expect(text().indexOf(LATE_ADD_MORE_TEXT)).toBeLessThan(text().indexOf('Nadadores tardíos ya enviados'))
    expect(text()).toContain('Agregar más nadadores tardíos')
    expect(text()).toContain('Registro manual')
    expect(text()).toContain('Registro experto')
    expect(text()).not.toContain('Finalizar y enviar inscripción') // sin nuevos no hay nada que enviar
  })

  it('agregar por el Registro experto: los nuevos van después de los fijos y al enviar viajan fijos + nuevos con los mismos Ath_no', async () => {
    await decide('approve', [5001])
    await openWizard()
    await act(async () => button('Importar archivo').click())
    await paste(NEW_ROW)
    const added = sectionTitled('Nadadores nuevos por enviar')
    expect(added.textContent).toContain('Nueva, Eva')
    expect(added.querySelector('span.w-6').textContent).toBe('4') // numerado desde la posición fija
    expect(added.querySelector('[aria-label="Editar a Eva"]')).toBeTruthy()
    expect(sectionTitled('Nadadores tardíos ya enviados').textContent).not.toContain('Eva')
    await act(async () => button('Finalizar y enviar inscripción').click())
    await act(async () => button('Confirmar y enviar').click())
    await settle()
    const sent = state.submitted.at(-1)
    expect(sent.roster.map((athlete) => athlete.lastName)).toEqual(['T0', 'T1', 'T2', 'Nueva'])
    expect(sent.athletes.map((athlete) => athlete.Ath_no)).toEqual([5001, 5002, 5003, 5004])
    // Y el servidor real lo acepta con la decisión intacta.
    await expect(state.wizard.submitInscription({ ...sent, pin: '1234' })).resolves.toMatchObject({ success: true })
    expect(db.tables.inscriptions.find((row) => row.is_late)).toMatchObject({ approved_athletes: [5001], late_status: 'partially_approved' })
  })

  it('Registro manual: el formulario sigue la numeración desde la posición fija', async () => {
    await decide('approve', [5001])
    await openWizard()
    await act(async () => button('Agregar nadadores').click())
    expect(text()).toContain('Inscribir nadador #4')
  })

  it('borrador rechazado porque no respeta a los fijos: aviso claro y el indicador sigue "en este dispositivo"', async () => {
    await decide('approve', [5001])
    state.saveDraft = async () => {
      throw Object.assign(new Error(LATE_FIXED_CHANGED_TEXT), { status: 409, lateFixedChanged: true })
    }
    await openWizard()
    await act(async () => button('Importar archivo').click())
    await paste(NEW_ROW)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2600))
    })
    await settle()
    expect(document.querySelector('[role="alert"]').textContent).toContain(LATE_FIXED_CHANGED_TEXT)
    expect(document.querySelector('[data-draft-status]').dataset.draftStatus).toBe('local')
    expect(button('Cargar la versión más reciente')).toBeTruthy()
  })

  it('fila vieja (estado final sin decisiones por nadador): sigue en solo lectura con el aviso de antes (D1)', async () => {
    Object.assign(db.tables.inscriptions.find((row) => row.is_late), { late_status: 'approved', approved_athletes: [], rejected_athletes: [], version: 2 })
    await openWizard()
    expect(text()).toContain(LATE_DECIDED_TEXT)
    expect(text()).not.toContain('Registro manual')
    expect(lateSection().querySelector('[aria-label^="Editar a"]')).toBeNull()
  })

  it('muestra los fijos del SERVIDOR aunque el navegador tenga un borrador distinto', async () => {
    await openWizard() // guarda el borrador local con T0..T2
    await unmountAll()
    const key = Object.keys(localStorage).find((item) => item.includes('evt-1'))
    const draft = JSON.parse(localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify({ ...draft, roster: [...draft.roster, { ...draft.roster[0], id: 'local', lastName: 'SoloLocal' }] }))
    await decide('approve_pending', [])
    await openWizard()
    expect(text()).not.toContain('SoloLocal')
    expect(sectionTitled('Nadadores tardíos ya enviados').querySelectorAll('[data-decision="approved"]')).toHaveLength(3)
  })
})
