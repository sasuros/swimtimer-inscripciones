// v1.18.0 — Guardias de concurrencia (anti-pisado). Cada fila de `inscriptions` lleva
// `version` (entero). Toda escritura exige la versión sobre la que se trabajó y la sube
// en +1; si otra escritura llegó antes, la condición no calza y no se pisa nada.

export const CONFLICT_TEXT =
  'Otra persona actualizó la inscripción de tu club mientras la editabas. Para no borrar sus cambios, no enviamos la tuya. Recarga el enlace: verás la lista más reciente y podrás agregar lo que falte.'
export const LATE_DECIDED_TEXT = 'El organizador ya revisó tu inscripción tardía. Para hacer cambios, escríbele.'
// Cliente sin expected_version. El wizard nuevo lo muestra en su propio panel. El bundle
// viejo (anterior al deploy) hace alert(`${error}. Tu lista sigue guardada…`) y no se puede
// cambiar: por eso el servidor manda el mismo texto SIN el punto final (evita "enviado..").
export const STALE_CLIENT_TEXT =
  'Esta página se actualizó. Recarga el enlace para continuar. Si tu club ya había enviado una inscripción, al recargar verás la última enviada: anota antes los cambios que no hayas enviado.'
export const STALE_CLIENT_SERVER_MESSAGE = STALE_CLIENT_TEXT.slice(0, -1)
export const ADMIN_CONFLICT_TEXT = 'Esta inscripción cambió mientras la tenías abierta. Recarga para ver la versión actual antes de aprobar.'
export const ROSTER_REPLACED_TEXT =
  'Alguien actualizó la inscripción de tu club después de tu última visita. Cargamos esa versión; si tenías cambios sin enviar en este dispositivo, vuelve a agregarlos.'

export class ConflictError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ConflictError'
    this.status = 409
    this.details = details
  }
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

// Mismo roster = mismo contenido y mismo orden (el orden define los Ath_no posicionales).
export const sameRoster = (a, b) => stable(a || []) === stable(b || [])
