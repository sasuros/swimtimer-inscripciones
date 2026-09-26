// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, useState } from 'react'
import TimeInput from './TimeInput'
import { validateAthlete } from '../utils/validation'
import { WIZARD_FORMAT_ERROR } from '../utils/timeParser'
import { mount, settle, unmountAll } from '../services/testSupport/dom.js'

// v1.19.0 ajustes (verificación en el iPhone).
const event = { eventIndex: 3, label: '25m Libre', distance: 25 }
function Harness({ initial }) {
  const [value, setValue] = useState(initial)
  return <TimeInput event={event} value={value} onChange={setValue} showError={false} />
}
const input = () => document.getElementById('time-3')

afterEach(unmountAll)

describe('al tocar el campo se selecciona todo (lo que se escriba reemplaza)', () => {
  // v1.19.1: act() async de React 18 se resuelve con un setImmediate real; con la máquina cargada
  // el setTimeout(0) del diferido corría antes y "todavía no" fallaba (1 de cada ~4 corridas en
  // paralelo). Con setTimeout falso, el diferido corre solo cuando el test lo pide.
  it('focus → selección 0..largo, diferida (no en el mismo tick)', async () => {
    await mount(<Harness initial="58:08.44" />)
    input().setSelectionRange(8, 8)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await act(async () => input().focus())
      expect([input().selectionStart, input().selectionEnd]).toEqual([8, 8]) // todavía no: es diferida
      await act(async () => vi.runOnlyPendingTimers())
      expect([input().selectionStart, input().selectionEnd]).toEqual([0, 8])
    } finally {
      vi.useRealTimers()
    }
  })

  it('con todo seleccionado, lo tipeado reemplaza: "58:08.44" + "12530" → "12530" (no "58:08.4412530")', async () => {
    await mount(<Harness initial="58:08.44" />)
    await act(async () => input().focus())
    await settle()
    input().setRangeText('12530', input().selectionStart, input().selectionEnd, 'end')
    expect(input().value).toBe('12530')
  })

  it('si el foco ya se fue antes del diferido, no toca la selección', async () => {
    await mount(<Harness initial="58:08.44" />)
    input().setSelectionRange(8, 8)
    await act(async () => {
      input().focus()
      input().blur()
    })
    await settle()
    expect([input().selectionStart, input().selectionEnd]).toEqual([8, 8])
  })
})

describe('"Revisa antes de continuar" usa el mismo mensaje del wizard', () => {
  it('validateAthlete (fuente del resumen) devuelve el texto nuevo para un tiempo ilegible', () => {
    const form = { lastName: 'Pérez', firstName: 'Ana', sex: 'F', birthDate: '2014-03-10', selectedEvents: [3], times: { 3: '1:7' } }
    const errors = validateAthlete(form, [], '2026-12-31', null, [[11, 12]])
    expect(errors['time-3']).toBe(WIZARD_FORMAT_ERROR)
  })
})
