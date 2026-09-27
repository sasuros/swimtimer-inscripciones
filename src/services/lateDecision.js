// v1.18.0 — Semántica de la revisión de tardías (una sola fuente para Supabase y la demo).
// Cada nadador tardío está pendiente, aprobado o rechazado. Una decisión es FINAL: solo se
// decide sobre pendientes y los no seleccionados no se tocan. late_status se deriva de los
// conteos; "necesita revisión" = queda al menos un nadador pendiente (no depende del status).

import { ConflictError, LATE_DECIDED_TEXT, LATE_FIXED_CHANGED_TEXT, LATE_NOTHING_NEW_TEXT, sameRoster } from './concurrency.js'

export class LateDecisionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LateDecisionError'
    this.status = 422
  }
}

export const LATE_ACTIONS = ['approve', 'reject', 'approve_pending']

const decidedSets = (late) => ({
  approved: new Set((late?.approved_athletes || []).map(Number)),
  rejected: new Set((late?.rejected_athletes || []).map(Number))
})

export const athleteName = (athlete) => [athlete?.First_name, athlete?.Last_name].filter(Boolean).join(' ') || `Nadador ${athlete?.Ath_no}`

export function athleteDecision(late, athleteNo) {
  const { approved, rejected } = decidedSets(late)
  const id = Number(athleteNo)
  return approved.has(id) ? 'approved' : rejected.has(id) ? 'rejected' : 'pending'
}

export const pendingAthletes = (late) => (late?.athletes || []).filter((athlete) => athleteDecision(late, athlete.Ath_no) === 'pending')

// Tardías viejas (antes de v1.18.0) cerradas con status final siguen fuera del panel.
export const needsReview = (late) => ['pending', 'partially_approved'].includes(late?.status) && pendingAthletes(late).length > 0

// D1: la tardía ya fue revisada si hay CUALQUIER decisión (no solo por status: una fila
// vieja o sucia con status 'pending' y decisiones tampoco se puede re-enviar).
export const hasLateDecision = (late) => Boolean(late) && (late.status !== 'pending' || (late.approved_athletes || []).length + (late.rejected_athletes || []).length > 0)

export function lateStatusFor(total, approvedCount, rejectedCount) {
  if (approvedCount + rejectedCount === 0) return 'pending'
  if (approvedCount === total) return 'approved'
  if (rejectedCount === total) return 'rejected'
  return 'partially_approved'
}

// Devuelve las listas nuevas o lanza LateDecisionError sin tocar nada.
export function applyLateDecision(late, action, athleteIds = []) {
  if (!LATE_ACTIONS.includes(action)) throw new LateDecisionError('Acción de revisión desconocida.')
  const athletes = late?.athletes || []
  const byNo = new Map(athletes.map((athlete) => [Number(athlete.Ath_no), athlete]))
  const ids = action === 'approve_pending' ? pendingAthletes(late).map((athlete) => Number(athlete.Ath_no)) : [...new Set(athleteIds.map(Number))]
  if (!ids.length) throw new LateDecisionError(action === 'approve_pending' ? 'No quedan nadadores pendientes en esta tardía.' : 'No seleccionaste ningún nadador.')
  if (ids.some((id) => !byNo.has(id))) throw new LateDecisionError('Un nadador seleccionado ya no está en esta tardía. No se guardó nada.')
  const already = ids.filter((id) => athleteDecision(late, id) !== 'pending')
  if (already.length) {
    const list = already.map((id) => `${athleteName(byNo.get(id))} (${athleteDecision(late, id) === 'approved' ? 'aprobado' : 'rechazado'})`).join(', ')
    throw new LateDecisionError(`Ya tenían una decisión: ${list}. Las decisiones no se pueden cambiar; no se guardó nada.`)
  }
  const { approved, rejected } = decidedSets(late)
  const target = action === 'reject' ? rejected : approved
  ids.forEach((id) => target.add(id))
  return {
    ids,
    approved_athletes: [...approved],
    rejected_athletes: [...rejected],
    status: lateStatusFor(athletes.length, approved.size, rejected.size)
  }
}

// v1.22.0 — Agregar nadadores a una tardía ya revisada. Los Ath_no son posicionales
// (club*1000 + posición + 1), y approved/rejected guardan esos números: por eso, con alguna
// decisión, TODOS los ya enviados (decididos o pendientes) quedan fijos, en el mismo orden,
// y solo se agregan nuevos al final.

// Filas de antes de v1.18.0 (o sin la lista del entrenador): estado final sin decisiones por
// nadador. Siguen bloqueadas como antes (D1): no se sabe quién quedó aprobado.
export const canAddToReviewedLate = (late) =>
  hasLateDecision(late) &&
  (late.approved_athletes || []).length + (late.rejected_athletes || []).length > 0 &&
  (late.athletes || []).length > 0 &&
  (late.roster || []).length === (late.athletes || []).length

// Cantidad de nadadores fijos (0 si la tardía no tiene decisiones).
export const lateFixedCount = (late) => (canAddToReviewedLate(late) ? late.athletes.length : 0)

export class LateResubmissionError extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'LateResubmissionError'
    this.reason = reason // 'fixedChanged' | 'nothingNew'
  }
}

// ¿La lista empieza con los fijos, idénticos y en el mismo orden?
export const keepsFixedRoster = (stored, roster = []) => sameFixed(stored.roster, roster, stored.athletes.length)
const sameFixed = (storedRoster, roster, count) => roster.length >= count && sameRoster(roster.slice(0, count), (storedRoster || []).slice(0, count))

// Arma la tardía nueva: los fijos se toman TAL COMO ESTÁN GUARDADOS (nadadores y pruebas), y
// del envío solo se aceptan los nuevos, en las posiciones siguientes. Las decisiones no se
// tocan y late_status se recalcula (los nuevos quedan pendientes: vuelve al panel).
export function mergeLateResubmission(stored, payload, clubCode) {
  const fixed = stored.athletes.length
  const roster = payload.roster || []
  if (!keepsFixedRoster(stored, roster)) throw new LateResubmissionError('fixedChanged')
  if (roster.length <= fixed) throw new LateResubmissionError('nothingNew')
  const newNos = new Set(roster.slice(fixed).map((_, index) => Number(clubCode) * 1000 + fixed + index + 1))
  const newAthletes = (payload.athletes || []).filter((athlete) => newNos.has(Number(athlete.Ath_no)))
  const unknown = (payload.athletes || []).some((athlete) => !newNos.has(Number(athlete.Ath_no)) && !stored.athletes.some((item) => Number(item.Ath_no) === Number(athlete.Ath_no)))
  if (unknown || newAthletes.length !== newNos.size) throw new LateResubmissionError('fixedChanged')
  const approved = stored.approved_athletes || []
  const rejected = stored.rejected_athletes || []
  const athletes = [...stored.athletes, ...newAthletes.sort((a, b) => Number(a.Ath_no) - Number(b.Ath_no))]
  return {
    athletes,
    results: [...(stored.results || []), ...(payload.results || []).filter((result) => newNos.has(Number(result.Ath_no)))],
    roster,
    approved_athletes: approved,
    rejected_athletes: rejected,
    late_status: lateStatusFor(athletes.length, approved.length, rejected.length)
  }
}

// v1.22.0 — Re-envío de una tardía con decisiones: fijos idénticos + nuevos al final. Devuelve
// los campos a escribir o lanza un 409 claro. Filas viejas sin decisiones por nadador: D1.
export function reviewedLateContent(stored, payload, clubCode) {
  if (!canAddToReviewedLate(stored)) throw new ConflictError(LATE_DECIDED_TEXT, { lateDecided: true })
  try {
    return mergeLateResubmission(stored, payload, clubCode)
  } catch (error) {
    if (!(error instanceof LateResubmissionError)) throw error
    if (error.reason === 'nothingNew') throw new ConflictError(LATE_NOTHING_NEW_TEXT, { lateNothingNew: true })
    throw new ConflictError(LATE_FIXED_CHANGED_TEXT, { lateFixedChanged: true })
  }
}
