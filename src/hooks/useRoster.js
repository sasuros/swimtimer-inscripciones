import { useCallback, useEffect, useRef, useState } from 'react'
import { sameRoster } from '../services/concurrency'

// v1.17.0: el borrador local se guarda por evento + club (antes por token). Así no
// se pierde al pasar del enlace largo al corto. La clave vieja se lee como respaldo
// para no perder borradores que quedaron a medio hacer al desplegar.
export const rosterDraftKey = (eventId, clubCode, isLate = false) => `swimtimer-roster:${eventId}:${clubCode}${isLate ? ':late' : ''}`
export const legacyRosterDraftKey = (token, isLate = false) => `swimtimer-roster:${isLate ? `${token}:late` : token}`

// v1.21.0: espera tras el último cambio antes de subir el borrador al servidor.
export const DRAFT_SAVE_DELAY_MS = 2500

// El borrador local se guarda como { roster, baseVersion, draftRev, dirty }. Nunca el PIN.
// - baseVersion (v1.18.0): versión de la inscripción del servidor sobre la que se editó.
// - draftRev (v1.21.0): rev del borrador del SERVIDOR en la que se basa este local.
// - dirty (v1.21.0): hay cambios que el servidor todavía no tiene.
export const localDraftValue = ({ roster, baseVersion, draftRev, dirty }) => ({ roster, baseVersion, draftRev, dirty })

function readLocal(storage, keys) {
  for (const key of keys) {
    let stored
    try {
      stored = JSON.parse(storage.getItem(key))
    } catch {
      continue // clave ilegible: se prueba la siguiente
    }
    const legacy = Array.isArray(stored)
    const roster = legacy ? stored : stored?.roster
    if (!Array.isArray(roster) || !roster.length) continue // vacío: no tapa al servidor
    const baseVersion = legacy ? null : Number(stored.baseVersion)
    return {
      roster,
      baseVersion: Number.isInteger(baseVersion) ? baseVersion : null,
      draftRev: legacy ? 0 : Number(stored.draftRev) || 0,
      // Formato de antes de v1.21.0 (sin el flag): se desconoce, se trata como posible cambio.
      dirty: legacy || typeof stored.dirty !== 'boolean' ? null : stored.dirty
    }
  }
  return null
}

// ¿Perder este local descarta trabajo? Si el flag se desconoce, cualquier diferencia cuenta.
const losesWork = (local, winner) => Boolean(local) && local.dirty !== false && !sameRoster(local.roster, winner)

// Decide qué lista se muestra al cargar. Nunca compara relojes: solo versiones y rev.
// (a) Un borrador (local o del servidor) basado en una versión de la inscripción ya
//     superada se descarta: gana el servidor.
// (b) Entre el local y el del servidor, gana el servidor si su rev es mayor que la rev en
//     la que se basa el local; si no, el local.
// Si gana el servidor y el local tenía cambios sin subir: replaced = true (aviso existente).
// remoteRev es la rev actual del servidor: el próximo guardado la manda como expected_rev.
export function resolveRosterDraft(storage, keys, server = {}, remote = null) {
  const serverRoster = server.roster || []
  const serverVersion = Number(server.version) || 0 // null = sin fila = versión 0
  const hasRemote = Boolean(remote) && Array.isArray(remote.roster)
  const remoteRev = hasRemote ? Number(remote.rev) || 0 : 0
  const result = (roster, baseVersion, extra = {}) => ({ roster, baseVersion, remoteRev, replaced: false, dirty: false, fromRemote: false, ...extra })
  const local = readLocal(storage, keys)
  const remoteUsable = hasRemote && remote.roster.length > 0 && Number(remote.base_version) >= serverVersion
  const localLegacy = local && local.baseVersion === null
  const localUsable = local && !localLegacy && local.baseVersion >= serverVersion

  if (remoteUsable && (!localUsable || remoteRev > local.draftRev)) {
    return result(remote.roster, Number(remote.base_version), { replaced: losesWork(local, remote.roster), fromRemote: true })
  }
  if (localUsable) return result(local.roster, local.baseVersion, { dirty: local.dirty !== false })
  // Borrador de antes de v1.18.0 (arreglo, sin baseVersion): sin fila en el servidor se
  // conserva; con fila, gana el servidor.
  if (localLegacy && serverVersion === 0) return result(local.roster, 0, { dirty: true })
  return result(serverRoster, serverVersion, { replaced: losesWork(local, serverRoster) })
}

// Compatibilidad con los tests y llamadas de v1.17.0: solo el roster resultante.
export const readRosterDraft = (storage, keys, initial = []) => resolveRosterDraft(storage, keys, { roster: initial, version: 0 }).roster

// Estado del indicador: 'local' (solo en este navegador), 'online' o 'conflict'
// (otro dispositivo guardó algo más nuevo). null: nada que indicar todavía.
export default function useRoster(key, initial = [], legacyKey = null, serverVersion = null, { remote = null, save = null } = {}) {
  const [draft] = useState(() => {
    try {
      return resolveRosterDraft(localStorage, [key, legacyKey].filter(Boolean), { roster: initial, version: serverVersion }, remote)
    } catch {
      return resolveRosterDraft({ getItem: () => null }, [], { roster: initial, version: serverVersion }, remote)
    }
  })
  const [roster, setRoster] = useState(draft.roster)
  const [status, setStatus] = useState(draft.dirty ? 'local' : draft.fromRemote ? 'online' : null)
  const sync = useRef({ rev: draft.remoteRev, dirty: draft.dirty, sending: false, stopped: false, roster: draft.roster })
  const mounted = useRef(false)
  const saveRef = useRef(save)
  saveRef.current = save

  const writeLocal = useCallback(() => {
    try {
      const { rev, dirty, roster: current } = sync.current
      localStorage.setItem(key, JSON.stringify(localDraftValue({ roster: current, baseVersion: draft.baseVersion, draftRev: rev, dirty })))
    } catch {
      // sin almacenamiento el borrador vive solo en memoria
    }
  }, [key, draft.baseVersion])

  // Sube el borrador. Cualquier error deja el trabajo en este navegador, sin alertas.
  // 409 por rev: otro dispositivo guardó antes. NO se reintenta (con el enlace v2 varios
  // entrenadores comparten el autor 'link': reintentar pisaría el borrador de otro).
  const flush = useCallback((options) => {
    const state = sync.current
    const send = saveRef.current
    if (!send || !state.dirty || state.sending || state.stopped) return
    const sent = state.roster
    state.sending = true
    send({ roster: sent, base_version: draft.baseVersion, expected_rev: state.rev }, options)
      .then((response) => {
        state.rev = Number(response?.rev) || state.rev
        if (sync.current.roster === sent) state.dirty = false
        writeLocal()
        setStatus(state.dirty ? 'local' : 'online')
      })
      .catch((error) => {
        if (error?.status === 409 && error.draftConflict) {
          state.stopped = true
          setStatus('conflict')
        } else {
          setStatus('local')
        }
      })
      .finally(() => {
        state.sending = false
      })
  }, [draft.baseVersion, writeLocal])

  useEffect(() => {
    sync.current.roster = roster
    if (mounted.current) sync.current.dirty = true
    mounted.current = true
    writeLocal()
    if (!sync.current.dirty) return undefined
    if (!sync.current.stopped) setStatus((current) => (current === 'conflict' ? current : 'local'))
    if (!saveRef.current) return undefined
    const timer = setTimeout(() => flush(), DRAFT_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [roster, writeLocal, flush])

  // Al esconder la pestaña (cerrar, cambiar de app) se sube lo pendiente sin esperar.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush({ keepalive: true })
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  // Tras enviar la inscripción no se sube nada más (el servidor ya purgó los borradores).
  const stop = useCallback(() => {
    sync.current.stopped = true
  }, [])

  return [roster, setRoster, { baseVersion: draft.baseVersion, replaced: draft.replaced, status, stop }]
}
