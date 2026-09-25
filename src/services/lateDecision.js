// v1.18.0 — Semántica de la revisión de tardías (una sola fuente para Supabase y la demo).
// Cada nadador tardío está pendiente, aprobado o rechazado. Una decisión es FINAL: solo se
// decide sobre pendientes y los no seleccionados no se tocan. late_status se deriva de los
// conteos; "necesita revisión" = queda al menos un nadador pendiente (no depende del status).

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
