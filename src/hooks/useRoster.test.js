import { describe, expect, it } from 'vitest'
import { legacyRosterDraftKey, readRosterDraft, rosterDraftKey } from './useRoster'

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
