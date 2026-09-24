import { useEffect, useState } from 'react'
import { sameRoster } from '../services/concurrency'

// v1.17.0: el borrador local se guarda por evento + club (antes por token). Así no
// se pierde al pasar del enlace largo al corto. La clave vieja se lee como respaldo
// para no perder borradores que quedaron a medio hacer al desplegar.
export const rosterDraftKey = (eventId, clubCode, isLate = false) => `swimtimer-roster:${eventId}:${clubCode}${isLate ? ':late' : ''}`
export const legacyRosterDraftKey = (token, isLate = false) => `swimtimer-roster:${isLate ? `${token}:late` : token}`

// v1.18.0: el borrador se guarda como { roster, baseVersion }: baseVersion es la versión
// del servidor sobre la que se empezó a editar (0 = no había fila). Al cargar:
// - servidor más nuevo que baseVersion → gana el servidor (replaced = true, con banner);
// - misma versión → gana el borrador local (el caso normal de "cerré y volví");
// - borrador viejo sin baseVersion (arreglo de antes del deploy) → gana el servidor si
//   hay fila; si no hay fila, se conserva.
// Los borradores vacíos se ignoran (no tapan un roster del servidor).
export function resolveRosterDraft(storage, keys, server = {}) {
  const serverRoster = server.roster || []
  const serverVersion = Number(server.version) || 0 // null = sin fila = versión 0
  const fromServer = { roster: serverRoster, baseVersion: serverVersion, replaced: false }
  for (const key of keys) {
    let stored
    try {
      stored = JSON.parse(storage.getItem(key))
    } catch {
      continue // clave ilegible: se prueba la siguiente
    }
    const legacy = Array.isArray(stored)
    const roster = legacy ? stored : stored?.roster
    if (!Array.isArray(roster) || !roster.length) continue
    const baseVersion = legacy ? null : Number(stored.baseVersion)
    if (legacy || !Number.isInteger(baseVersion)) {
      if (serverVersion === 0) return { roster, baseVersion: 0, replaced: false }
      return { ...fromServer, replaced: !sameRoster(roster, serverRoster) }
    }
    if (serverVersion > baseVersion) return { ...fromServer, replaced: true }
    return { roster, baseVersion, replaced: false }
  }
  return fromServer
}

// Compatibilidad con los tests y llamadas de v1.17.0: solo el roster resultante.
export const readRosterDraft = (storage, keys, initial = []) => resolveRosterDraft(storage, keys, { roster: initial, version: 0 }).roster

export default function useRoster(key, initial = [], legacyKey = null, serverVersion = null) {
  const [draft] = useState(() => resolveRosterDraft(localStorage, [key, legacyKey].filter(Boolean), { roster: initial, version: serverVersion }))
  const [roster, setRoster] = useState(draft.roster)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ roster, baseVersion: draft.baseVersion }))
    } catch {
      // sin almacenamiento el borrador vive solo en memoria
    }
  }, [key, roster, draft.baseVersion])
  return [roster, setRoster, { baseVersion: draft.baseVersion, replaced: draft.replaced }]
}
