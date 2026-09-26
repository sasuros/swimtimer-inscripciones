// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useRoster, { DRAFT_SAVE_DELAY_MS, rosterDraftKey } from './useRoster'
import { mount, unmountAll } from '../services/testSupport/dom'

// v1.21.0 — El hook sube el borrador tras una espera, nunca guarda el PIN en localStorage,
// no reintenta ante un 409 de rev y trata cualquier falla como "guardado en este dispositivo".
const KEY = rosterDraftKey('evt-1', 5)
const PIN = '4827'
let hook

function Probe({ save, remote = null, version = 0 }) {
  const [roster, setRoster, draft] = useRoster(KEY, [], null, version, { remote, save })
  hook = { roster, setRoster, draft }
  return null
}
const add = (id) => act(async () => hook.setRoster((current) => [...current, { id }]))
const wait = (ms) =>
  act(async () => {
    vi.advanceTimersByTime(ms)
    for (let i = 0; i < 5; i += 1) await Promise.resolve()
  })
const stored = () => JSON.parse(localStorage.getItem(KEY))

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(async () => {
  await unmountAll()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('guardado en el servidor desde el hook', () => {
  it('espera al último cambio, manda base_version y expected_rev, y marca "en línea"', async () => {
    const save = vi.fn(async () => ({ saved: true, rev: 1 }))
    await mount(<Probe save={save} />)
    expect(hook.draft.status).toBe(null)
    await add('A')
    await wait(1000)
    await add('B')
    expect(hook.draft.status).toBe('local')
    await wait(DRAFT_SAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await wait(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toEqual({ roster: [{ id: 'A' }, { id: 'B' }], base_version: 0, expected_rev: 0 })
    expect(hook.draft.status).toBe('online')
    expect(stored()).toEqual({ roster: [{ id: 'A' }, { id: 'B' }], baseVersion: 0, draftRev: 1, dirty: false })
  })

  it('el PIN nunca se escribe en localStorage (ni dentro del borrador)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const request = vi.fn(async () => ({ saved: true, rev: 1 }))
    await mount(<Probe save={(body) => request({ token: 'tok', pin: PIN, ...body })} />)
    await add('A')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(request.mock.calls[0][0].pin).toBe(PIN) // viaja en la petición…
    const written = setItem.mock.calls.map(([, value]) => String(value)).join('\n')
    expect(written).not.toContain(PIN) // …pero nunca se guarda
    expect(Object.keys(stored()).sort()).toEqual(['baseVersion', 'dirty', 'draftRev', 'roster'])
    for (let i = 0; i < localStorage.length; i += 1) expect(localStorage.getItem(localStorage.key(i))).not.toContain(PIN)
  })

  it('409 por rev: no reintenta, conserva el local y avisa que hay cambios más nuevos en otro dispositivo', async () => {
    const save = vi.fn(async () => {
      throw Object.assign(new Error('rev'), { status: 409, draftConflict: true })
    })
    await mount(<Probe save={save} />)
    await add('A')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(hook.draft.status).toBe('conflict')
    await add('B')
    await wait(DRAFT_SAVE_DELAY_MS * 3)
    expect(save).toHaveBeenCalledTimes(1)
    expect(hook.draft.status).toBe('conflict')
    expect(stored()).toMatchObject({ roster: [{ id: 'A' }, { id: 'B' }], dirty: true, draftRev: 0 })
  })

  it.each([
    ['429', { status: 429 }],
    ['de red', {}],
    ['5xx', { status: 500 }],
    ['por base superada', { status: 409, staleBase: true }]
  ])('falla %s: sin error visible, "Guardado en este dispositivo" y el trabajo sigue', async (_name, failure) => {
    const save = vi.fn(async () => {
      throw Object.assign(new Error('falla'), failure)
    })
    await mount(<Probe save={save} />)
    await add('A')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(hook.draft.status).toBe('local')
    expect(stored()).toMatchObject({ roster: [{ id: 'A' }], dirty: true })
    await add('B')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(2) // sigue intentando con cada cambio
  })

  it('sin servidor (demo): solo local', async () => {
    await mount(<Probe save={null} />)
    await add('A')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(hook.draft.status).toBe('local')
  })

  it('el borrador del servidor que gana se muestra "en línea" y el próximo guardado manda su rev', async () => {
    const save = vi.fn(async () => ({ saved: true, rev: 5 }))
    await mount(<Probe save={save} version={1} remote={{ roster: [{ id: 'R' }], base_version: 1, rev: 4 }} />)
    expect(hook.roster).toEqual([{ id: 'R' }])
    expect(hook.draft.status).toBe('online')
    await add('A')
    await wait(DRAFT_SAVE_DELAY_MS)
    expect(save.mock.calls[0][0]).toEqual({ roster: [{ id: 'R' }, { id: 'A' }], base_version: 1, expected_rev: 4 })
  })

  it('al esconder la pestaña sube lo pendiente sin esperar (keepalive); después de enviar, nada', async () => {
    const save = vi.fn(async () => ({ saved: true, rev: 1 }))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await mount(<Probe save={save} />)
    await add('A')
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ roster: [{ id: 'A' }] }), { keepalive: true })
    await wait(DRAFT_SAVE_DELAY_MS)
    hook.draft.stop()
    await add('B')
    await wait(DRAFT_SAVE_DELAY_MS)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(save).toHaveBeenCalledTimes(1)
    visibility.mockRestore()
  })
})
