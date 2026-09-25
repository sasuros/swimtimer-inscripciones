import { athleteName } from '../services/lateDecision'

// v1.18.0 — Textos de la revisión de tardías del admin (confirmación, resultado y conflicto).
export const clubLabel = (club) => club?.abbreviation || club?.short_name || club?.name || `Club ${club?.code ?? ''}`.trim()

const swimmers = (n) => `${n} ${n === 1 ? 'nadador' : 'nadadores'}`
const MAX_NAMES = 5

export const remainingText = (n) => `${n === 1 ? 'Queda' : 'Quedan'} ${n} por revisar`

export function namesList(athletes) {
  const names = athletes.map(athleteName)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0] || ''
}

// Hasta 5 nadadores se nombran; con más, el conteo.
export function confirmText(action, athletes, club) {
  const verb = action === 'reject' ? 'Rechazar' : 'Aprobar'
  const who = athletes.length > MAX_NAMES ? (action === 'approve_pending' ? `los ${athletes.length} nadadores pendientes` : `${athletes.length} nadadores`) : namesList(athletes)
  return `¿${verb} a ${who} (${clubLabel(club)})? Esta decisión no se puede cambiar después.`
}

export function reviewSuccessText(action, count, club, remaining) {
  const label = clubLabel(club)
  const done = action === 'reject' ? `Rechazaste a ${swimmers(count)} de ${label}.` : action === 'approve_pending' && count > 1 ? `Aprobaste a los ${count} nadadores pendientes de ${label}.` : `Aprobaste a ${swimmers(count)} de ${label}.`
  return `${done} ${remaining > 0 ? `${remainingText(remaining)}.` : `La tardía de ${label} quedó revisada.`}`
}

export const lateConflictText = (club) => `La inscripción tardía de ${clubLabel(club)} cambió mientras la revisabas. Ya cargamos la versión actual: revísala y vuelve a aprobar o rechazar.`
