import { useEffect, useState } from 'react'

// v1.17.0: el borrador local se guarda por evento + club (antes por token). Así no
// se pierde al pasar del enlace largo al corto. La clave vieja se lee como respaldo
// para no perder borradores que quedaron a medio hacer al desplegar.
export const rosterDraftKey = (eventId, clubCode, isLate = false) => `swimtimer-roster:${eventId}:${clubCode}${isLate ? ':late' : ''}`
export const legacyRosterDraftKey = (token, isLate = false) => `swimtimer-roster:${isLate ? `${token}:late` : token}`

export function readRosterDraft(storage, keys, initial = []) {
  for (const key of keys) {
    try {
      const stored = JSON.parse(storage.getItem(key))
      if (Array.isArray(stored) && stored.length) return stored
    } catch {
      // clave ilegible: se prueba la siguiente
    }
  }
  return initial
}

export default function useRoster(key, initial = [], legacyKey = null) {
  const [roster, setRoster] = useState(() => readRosterDraft(localStorage, [key, legacyKey].filter(Boolean), initial))
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(roster))
    } catch {
      // sin almacenamiento el borrador vive solo en memoria
    }
  }, [key, roster])
  return [roster, setRoster]
}
