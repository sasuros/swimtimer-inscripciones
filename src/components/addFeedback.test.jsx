// @vitest-environment jsdom
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADD_FEEDBACK_MS, addedText, editedText, eventsSummary, importedNotice } from '../utils/addFeedback'
import useAddFeedback from '../hooks/useAddFeedback'
import AthleteForm from './AthleteForm'
import QuickEntryMode from './QuickEntryMode'
import RosterPanel from './RosterPanel'
import { AddedNotice } from './WizardNotices'
import { button, mount, unmountAll } from '../services/testSupport/dom'

// v1.21.1 — En el iPhone el formulario se vaciaba sin ninguna señal. Ahora hay un aviso
// verde arriba del formulario y el nadador se resalta en la lista. Nada del guardado cambia.
const ev = (label) => ({ label })
const ana = { id: 'a1', lastName: 'Pérez', firstName: 'Ana', sex: 'F', events: [ev('50m Libre'), ev('100m Espalda')] }
const GREEN = 'rounded-xl p-4 text-sm bg-success-50 text-success-800'
const AMBER = 'rounded-xl p-4 text-sm bg-warning-50 text-warning-800'

describe('textos', () => {
  it('agregar: apellido, nombre, pruebas y total de la lista (singular y plural)', () => {
    expect(addedText(ana, 3)).toBe('✓ Agregaste a Pérez, Ana (50m Libre, 100m Espalda). Ya tienes 3 nadadores en la lista.')
    expect(addedText(ana, 1)).toBe('✓ Agregaste a Pérez, Ana (50m Libre, 100m Espalda). Ya tienes 1 nadador en la lista.')
  })

  it('tardías: "en la lista de tardías"', () => {
    expect(addedText(ana, 2, true)).toBe('✓ Agregaste a Pérez, Ana (50m Libre, 100m Espalda). Ya tienes 2 nadadores en la lista de tardías.')
  })

  it('máximo 3 pruebas y "y N más"', () => {
    const labels = ['50m Libre', '100m Espalda', '50m Pecho', '50m Mariposa', '200m Combinado']
    expect(eventsSummary(labels.slice(0, 3).map(ev))).toBe('50m Libre, 100m Espalda, 50m Pecho')
    expect(eventsSummary(labels.map(ev))).toBe('50m Libre, 100m Espalda, 50m Pecho y 2 más')
    expect(addedText({ ...ana, events: [] }, 1)).toBe('✓ Agregaste a Pérez, Ana. Ya tienes 1 nadador en la lista.')
  })

  it('editar', () => {
    expect(editedText(ana)).toBe('✓ Guardaste los cambios de Pérez, Ana.')
  })

  it('importar: todos nuevos, mixto (singular y plural) y ninguno nuevo', () => {
    expect(importedNotice(4, 0)).toEqual({ kind: 'success', text: '✓ Agregaste 4 nadadores a la lista.' })
    expect(importedNotice(3, 2)).toEqual({ kind: 'success', text: '✓ Agregaste 3 nadadores a la lista. 2 ya estaban y no se repitieron.' })
    expect(importedNotice(1, 1)).toEqual({ kind: 'success', text: '✓ Agregaste 1 nadador a la lista. 1 ya estaba y no se repitió.' })
    expect(importedNotice(2, 0, true).text).toBe('✓ Agregaste 2 nadadores a la lista de tardías.')
    expect(importedNotice(0, 3)).toEqual({ kind: 'warning', text: 'No se agregó ningún nadador: ya estaban en la lista.' })
  })
})

describe('render', () => {
  it('aviso verde (o ámbar) con las clases de los avisos existentes, dentro de role="status"', () => {
    const green = renderToStaticMarkup(<AddedNotice notice={{ kind: 'success', text: 'hola' }} className="mb-6" />)
    expect(green).toBe(`<div role="status" aria-live="polite"><div data-added-notice="success" class="mb-6 ${GREEN}">hola</div></div>`)
    expect(renderToStaticMarkup(<AddedNotice notice={{ kind: 'warning', text: 'ojo' }} />)).toContain(`class=" ${AMBER}"`)
  })

  it('sin aviso el contenedor vivo sigue presente (VoiceOver anuncia al cambiar el texto)', () => {
    expect(renderToStaticMarkup(<AddedNotice notice={null} />)).toBe('<div role="status" aria-live="polite"></div>')
  })

  it('el formulario muestra el aviso arriba, antes del título "Nuevo registro"', () => {
    const html = renderToStaticMarkup(<AthleteForm roster={[ana]} referenceDate="2026-12-31" eventConfig={{ events: [] }} editing={null} onSave={() => {}} onCancelEdit={() => {}} notice={{ kind: 'success', text: addedText(ana, 1) }} />)
    expect(html.indexOf('✓ Agregaste a Pérez, Ana')).toBeGreaterThan(-1)
    expect(html.indexOf('✓ Agregaste a Pérez, Ana')).toBeLessThan(html.indexOf('Nuevo registro'))
  })

  it('la lista resalta a los recién agregados con la clase existente', () => {
    const html = renderToStaticMarkup(<RosterPanel roster={[ana, { ...ana, id: 'a2', firstName: 'Eva' }]} onEdit={() => {}} onDelete={() => {}} highlightIds={['a2']} />)
    expect(html.match(/bg-success-50/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<RosterPanel roster={[ana]} onEdit={() => {}} onDelete={() => {}} />)).not.toContain('bg-success-50')
  })
})

describe('useAddFeedback: 8 s, reemplazo y cierre', () => {
  let hook
  function Probe() {
    hook = useAddFeedback()
    return null
  }
  beforeEach(() => vi.useFakeTimers())
  afterEach(async () => {
    await unmountAll()
    vi.useRealTimers()
  })
  const advance = (ms) => act(async () => vi.advanceTimersByTime(ms))

  it('desaparece a los 8 s, igual que el resaltado', async () => {
    await mount(<Probe />)
    await act(async () => hook.show({ text: 'uno' }, ['a1']))
    expect(hook.notice).toEqual({ kind: 'success', text: 'uno' })
    expect(hook.highlightIds).toEqual(['a1'])
    await advance(ADD_FEEDBACK_MS - 1)
    expect(hook.notice).not.toBeNull()
    await advance(1)
    expect(hook.notice).toBeNull()
    expect(hook.highlightIds).toEqual([])
  })

  it('agregar el siguiente lo reemplaza y reinicia los 8 s', async () => {
    await mount(<Probe />)
    await act(async () => hook.show({ text: 'uno' }, ['a1']))
    await advance(6000)
    await act(async () => hook.show({ text: 'dos' }, ['a2']))
    await advance(6000)
    expect(hook.notice.text).toBe('dos')
    expect(hook.highlightIds).toEqual(['a2'])
    await advance(2000)
    expect(hook.notice).toBeNull()
  })

  it('"Editar" / "Cambiar método" lo cierran (dismiss)', async () => {
    await mount(<Probe />)
    await act(async () => hook.show({ text: 'uno' }))
    await act(async () => hook.dismiss())
    expect(hook.notice).toBeNull()
  })
})

describe('Registro experto: cuenta los agregados y los que ya estaban', () => {
  afterEach(unmountAll)
  const events = [{ event_ptr: 1, distance: 50, style: 'Libre', age_lo: 8, age_hi: 12, sex: 'F', active: true }]

  it('importar manda los nuevos y cuántos se omitieron; muestra el aviso junto al botón', async () => {
    const onImport = vi.fn()
    const view = await mount(<QuickEntryMode referenceDate="2026-10-17" eventConfig={{ events }} club={{ name: 'CAC' }} roster={[{ ...ana, events: [] }]} onImport={onImport} />)
    const textarea = view.host.querySelector('#quick-entry')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    await act(async () => {
      setter.call(textarea, 'Pérez | Ana | F | 15/05/2016 | 50m Libre | 32.56\nRodríguez | María | F | 10/02/2016 | 50m Libre | 33.10')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => button('Validar filas', view.host).click())
    await act(async () => button('Importar', view.host).click())
    expect(onImport).toHaveBeenCalledTimes(1)
    const [additions, info] = onImport.mock.calls[0]
    expect(additions.map((item) => item.lastName)).toEqual(['Rodríguez'])
    expect(info).toEqual({ skipped: 1 })

    await view.rerender(<QuickEntryMode referenceDate="2026-10-17" eventConfig={{ events }} club={{ name: 'CAC' }} roster={[]} onImport={onImport} notice={importedNotice(1, 1)} />)
    expect(view.host.textContent).toContain('✓ Agregaste 1 nadador a la lista. 1 ya estaba y no se repitió.')
  })
})
