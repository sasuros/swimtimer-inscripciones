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
    expect(resolveRosterDraft(draft(local, 1), [key], { roster: server, version: 2 })).toMatchObject({ roster: server, baseVersion: 2, replaced: true })
  })

  it('baseVersion igual → gana el borrador local ("cerré y volví")', () => {
    expect(resolveRosterDraft(draft(local, 2), [key], { roster: server, version: 2 })).toMatchObject({ roster: local, baseVersion: 2, replaced: false })
  })

  it('null = 0: borrador hecho sin fila (0); otro entrenador envía la versión 1 → pierde el borrador', () => {
    expect(resolveRosterDraft(draft(local, 0), [key], { roster: [], version: null })).toMatchObject({ roster: local, baseVersion: 0, replaced: false })
    expect(resolveRosterDraft(draft(local, 0), [key], { roster: server, version: 1 })).toMatchObject({ roster: server, baseVersion: 1, replaced: true })
  })

  it('borrador viejo sin baseVersion (arreglo) + fila en el servidor → gana el servidor', () => {
    const legacy = storage({ [key]: JSON.stringify(local) })
    expect(resolveRosterDraft(legacy, [key], { roster: server, version: 1 })).toMatchObject({ roster: server, baseVersion: 1, replaced: true })
    // Si era una copia idéntica de lo enviado, no hay nada que avisar.
    expect(resolveRosterDraft(storage({ [key]: JSON.stringify(server) }), [key], { roster: server, version: 1 }).replaced).toBe(false)
  })

  it('borrador viejo sin baseVersion y SIN fila en el servidor → se conserva', () => {
    expect(resolveRosterDraft(storage({ [key]: JSON.stringify(local) }), [key], { roster: [], version: 0 })).toMatchObject({ roster: local, baseVersion: 0, replaced: false })
  })

  it('sin borrador (o vacío) → servidor, con su versión como baseVersion', () => {
    expect(resolveRosterDraft(storage({}), [key], { roster: server, version: 3 })).toMatchObject({ roster: server, baseVersion: 3, replaced: false })
    expect(resolveRosterDraft(draft([], 1), [key], { roster: server, version: 3 })).toMatchObject({ roster: server, baseVersion: 3, replaced: false })
  })
})

describe('borrador local vs servidor por rev (v1.21.0): nunca por reloj', () => {
  const key = rosterDraftKey('evt-1', 5)
  const local = [{ id: 'local' }]
  const remoteRoster = [{ id: 'remoto' }]
  const inscription = [{ id: 'enviado' }]
  const stored = (value) => storage({ [key]: JSON.stringify({ roster: local, baseVersion: 1, ...value }) })
  const remote = (rev, base = 1) => ({ roster: remoteRoster, base_version: base, rev })

  it('(b) rev del servidor mayor que la del local → gana el servidor', () => {
    expect(resolveRosterDraft(stored({ draftRev: 2, dirty: false }), [key], { roster: inscription, version: 1 }, remote(3))).toMatchObject({ roster: remoteRoster, baseVersion: 1, remoteRev: 3, replaced: false })
  })

  it('(b) misma rev → gana el local (sus cambios sin subir se conservan) y la rev a mandar es la del servidor', () => {
    expect(resolveRosterDraft(stored({ draftRev: 3, dirty: true }), [key], { roster: inscription, version: 1 }, remote(3))).toMatchObject({ roster: local, remoteRev: 3, dirty: true, replaced: false })
  })

  it('(b) gana el servidor y el local tenía cambios sin subir → aviso', () => {
    expect(resolveRosterDraft(stored({ draftRev: 2, dirty: true }), [key], { roster: inscription, version: 1 }, remote(3))).toMatchObject({ roster: remoteRoster, replaced: true })
  })

  it('(a) inscripción más nueva que ambos borradores → gana la inscripción; aviso solo si el local tenía cambios', () => {
    expect(resolveRosterDraft(stored({ draftRev: 3, dirty: true }), [key], { roster: inscription, version: 2 }, remote(3))).toMatchObject({ roster: inscription, baseVersion: 2, replaced: true })
    expect(resolveRosterDraft(stored({ draftRev: 3, dirty: false }), [key], { roster: inscription, version: 2 }, remote(3))).toMatchObject({ roster: inscription, baseVersion: 2, replaced: false })
  })

  it('(a) borrador del servidor superado, local al día → gana el local', () => {
    const current = storage({ [key]: JSON.stringify({ roster: local, baseVersion: 2, draftRev: 0, dirty: true }) })
    expect(resolveRosterDraft(current, [key], { roster: inscription, version: 2 }, remote(5, 1))).toMatchObject({ roster: local, baseVersion: 2 })
  })

  it('sin local: gana el borrador del servidor si no está superado', () => {
    expect(resolveRosterDraft(storage({}), [key], { roster: inscription, version: 1 }, remote(1))).toMatchObject({ roster: remoteRoster, fromRemote: true, replaced: false })
    expect(resolveRosterDraft(storage({}), [key], { roster: inscription, version: 2 }, remote(1))).toMatchObject({ roster: inscription, fromRemote: false })
  })

  it('un local idéntico al ganador no cuenta como trabajo perdido', () => {
    const same = storage({ [key]: JSON.stringify({ roster: remoteRoster, baseVersion: 1, draftRev: 2, dirty: true }) })
    expect(resolveRosterDraft(same, [key], { roster: inscription, version: 1 }, remote(3)).replaced).toBe(false)
  })
})
