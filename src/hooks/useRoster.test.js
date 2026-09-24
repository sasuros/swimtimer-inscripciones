import { describe, expect, it } from 'vitest'
import { legacyRosterDraftKey, readRosterDraft, resolveRosterDraft, rosterDraftKey } from './useRoster'

const storage = (entries) => ({ getItem: (key) => (key in entries ? entries[key] : null) })

describe('borrador local por evento + club (v1.17.0)', () => {
  it('la clave no depende del token (largo o corto dan la misma)', () => {
    expect(rosterDraftKey('evt-1', 5)).toBe('swimtimer-roster:evt-1:5')
    expect(rosterDraftKey('evt-1', 5, true)).toBe('swimtimer-roster:evt-1:5:late')
    expect(legacyRosterDraftKey('eyJtoken')).toBe('swimtimer-roster:eyJtoken')
    expect(legacyRosterDraftKey('eyJtoken', true)).toBe('swimtimer-roster:eyJtoken:late')
  })

  it('prefiere la clave nueva, cae a la vieja y si no hay nada usa la precarga', () => {
    const keys = [rosterDraftKey('evt-1', 5), legacyRosterDraftKey('eyJtoken')]
    expect(readRosterDraft(storage({ [keys[0]]: '[{"id":"nuevo"}]', [keys[1]]: '[{"id":"viejo"}]' }), keys, [])).toEqual([{ id: 'nuevo' }])
    expect(readRosterDraft(storage({ [keys[1]]: '[{"id":"viejo"}]' }), keys, [])).toEqual([{ id: 'viejo' }])
    expect(readRosterDraft(storage({ [keys[0]]: '[]', [keys[1]]: 'no-json' }), keys, [{ id: 'precarga' }])).toEqual([{ id: 'precarga' }])
  })
})

describe('borrador vs servidor por versión (v1.18.0)', () => {
  const key = rosterDraftKey('evt-1', 5)
  const local = [{ id: 'local' }]
  const server = [{ id: 'servidor' }]
  const draft = (roster, baseVersion) => storage({ [key]: JSON.stringify({ roster, baseVersion }) })

  it('baseVersion vieja → gana el servidor (con banner) y baseVersion pasa a la del servidor', () => {
    expect(resolveRosterDraft(draft(local, 1), [key], { roster: server, version: 2 })).toEqual({ roster: server, baseVersion: 2, replaced: true })
  })

  it('baseVersion igual → gana el borrador local ("cerré y volví")', () => {
    expect(resolveRosterDraft(draft(local, 2), [key], { roster: server, version: 2 })).toEqual({ roster: local, baseVersion: 2, replaced: false })
  })

  it('null = 0: borrador hecho sin fila (0); otro entrenador envía la versión 1 → pierde el borrador', () => {
    expect(resolveRosterDraft(draft(local, 0), [key], { roster: [], version: null })).toEqual({ roster: local, baseVersion: 0, replaced: false })
    expect(resolveRosterDraft(draft(local, 0), [key], { roster: server, version: 1 })).toEqual({ roster: server, baseVersion: 1, replaced: true })
  })

  it('borrador viejo sin baseVersion (arreglo) + fila en el servidor → gana el servidor', () => {
    const legacy = storage({ [key]: JSON.stringify(local) })
    expect(resolveRosterDraft(legacy, [key], { roster: server, version: 1 })).toEqual({ roster: server, baseVersion: 1, replaced: true })
    // Si era una copia idéntica de lo enviado, no hay nada que avisar.
    expect(resolveRosterDraft(storage({ [key]: JSON.stringify(server) }), [key], { roster: server, version: 1 }).replaced).toBe(false)
  })

  it('borrador viejo sin baseVersion y SIN fila en el servidor → se conserva', () => {
    expect(resolveRosterDraft(storage({ [key]: JSON.stringify(local) }), [key], { roster: [], version: 0 })).toEqual({ roster: local, baseVersion: 0, replaced: false })
  })

  it('sin borrador (o vacío) → servidor, con su versión como baseVersion', () => {
    expect(resolveRosterDraft(storage({}), [key], { roster: server, version: 3 })).toEqual({ roster: server, baseVersion: 3, replaced: false })
    expect(resolveRosterDraft(draft([], 1), [key], { roster: server, version: 3 })).toEqual({ roster: server, baseVersion: 3, replaced: false })
  })
})
