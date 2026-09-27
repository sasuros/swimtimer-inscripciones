// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.21.1 — En el wizard real: importar/editar muestra la confirmación, resalta en la lista
// y NO mueve la pantalla. Club 5, PIN 1234, evento activo con la prueba 50m Libre (F 8-12).
const state = vi.hoisted(() => ({ wizard: null }))
vi.mock('../services/api', () => ({
  validateToken: (token, pin) => state.wizard.validateToken(token, { pin }),
  submitInscription: async () => ({ success: true }),
  saveDraft: async () => ({ saved: true, rev: 1 })
}))

const { default: InscriptionWizard } = await import('./InscriptionWizard.jsx')
const { __setSupabaseClient } = await import('../services/supabaseStorage.js')
const { seed } = await import('../services/testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('../services/wizardSupabase.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { button, mount, settle, unmountAll } = await import('../services/testSupport/dom.js')

let token, scrolls
const text = () => document.body.textContent
const openWizard = async () => {
  window.history.replaceState(null, '', `/inscribir?t=${encodeURIComponent(token)}`)
  sessionStorage.setItem(`swimtimer-pin:${token}`, '1234')
  await mount(<InscriptionWizard />)
  await settle()
}
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
const ROWS = 'Pérez | Ana | F | 15/05/2016 | 50m Libre | 32.56\nRodríguez | María | F | 10/02/2016 | 50m Libre | 33.10'

beforeEach(async () => {
  let db
  ;({ db, token } = await seed())
  db.tables.event_events.push({ event_id: 'evt-1', event_ptr: 1, distance: 50, style: 'Libre', age_lo: 8, age_hi: 12, sex: 'F', active: true })
  state.wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  localStorage.clear()
  scrolls = { into: vi.fn(), to: vi.fn() }
  Element.prototype.scrollIntoView = scrolls.into
  window.scrollTo = scrolls.to
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('confirmación en el wizard', () => {
  it('importar: aviso con el total, ambos resaltados en la lista y sin mover la pantalla', async () => {
    await openWizard()
    await act(async () => button('Importar archivo').click())
    await paste(ROWS)
    expect(text()).toContain('✓ Agregaste 2 nadadores a la lista.')
    const notice = document.querySelector('[data-added-notice]')
    expect(notice.closest('[role="status"]')).toBeTruthy()
    expect(document.querySelectorAll('.bg-success-50 .truncate')).toHaveLength(2)
    expect(scrolls.into).not.toHaveBeenCalled()
    expect(scrolls.to).not.toHaveBeenCalled()

    // Otra importación con uno repetido: mixto, reemplaza el aviso anterior.
    await paste('Pérez | Ana | F | 15/05/2016 | 50m Libre | 32.56\nGómez | Eva | F | 01/03/2015 | 50m Libre | 31.00')
    expect(text()).toContain('✓ Agregaste 1 nadador a la lista. 1 ya estaba y no se repitió.')
    expect(text()).not.toContain('✓ Agregaste 2 nadadores')
    expect(scrolls.into).not.toHaveBeenCalled()
  })

  it('editar y guardar: "Guardaste los cambios"; tocar "Editar" cierra el aviso anterior', async () => {
    await openWizard()
    await act(async () => button('Importar archivo').click())
    await paste(ROWS)
    await act(async () => document.querySelector('[aria-label="Editar a Ana"]').click())
    await settle()
    expect(text()).not.toContain('✓ Agregaste')
    scrolls.into.mockClear()
    await act(async () => button('Guardar cambios').click())
    await settle()
    expect(text()).toContain('✓ Guardaste los cambios de Pérez, Ana.')
    expect(scrolls.into).not.toHaveBeenCalled()
  })

  it('el guardado no cambia: la lista local tiene a los importados', async () => {
    await openWizard()
    await act(async () => button('Importar archivo').click())
    await paste(ROWS)
    const stored = JSON.parse(localStorage.getItem('swimtimer-roster:evt-1:5'))
    expect(stored.roster.map((athlete) => athlete.lastName)).toEqual(['Pérez', 'Rodríguez'])
  })
})
