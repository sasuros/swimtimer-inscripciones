import { athleteDecision } from '../services/lateDecision'

// Vista por club: inscripción regular + nadadores tardíos APROBADOS.
// Misma regla que el consolidado (mmSchema.js): la tardía cuenta si está approved/partially_approved
// y solo con los Ath_no presentes en approved_athletes. La regular y la tardía numeran Ath_no
// por separado (pueden repetirse), por eso cada una se filtra por su cuenta.
const LATE_VISIBLE = ['approved', 'partially_approved']

function approvedLate(late) {
  if (!late || !LATE_VISIBLE.includes(late.status)) return { roster: [], athletes: [], results: [] }
  const approved = new Set((late.approved_athletes || []).map(Number))
  const athletes = late.athletes || []
  const roster = late.roster || []
  // roster[i] corresponde a athletes[i]: buildMMExport asigna Ath_no por posición.
  const keep = athletes.map(athlete => approved.has(Number(athlete.Ath_no)))
  const approvedNos = new Set(athletes.filter((_, index) => keep[index]).map(athlete => Number(athlete.Ath_no)))
  return {
    roster: roster.filter((_, index) => keep[index]),
    athletes: athletes.filter((_, index) => keep[index]),
    results: (late.results || []).filter(result => approvedNos.has(Number(result.Ath_no)))
  }
}

export function mergeClubInscriptions(regular, late) {
  const lateApproved = approvedLate(late)
  const regularAthletes = regular?.athletes || []
  const regularResults = regular?.results || []
  const athleteCount = regularAthletes.length + lateApproved.athletes.length
  return {
    regularRoster: regular?.roster || [],
    lateApprovedRoster: lateApproved.roster,
    lateApprovedCount: lateApproved.athletes.length,
    athleteCount,
    resultCount: regularResults.length + lateApproved.results.length,
    hasAny: Boolean(regular) || athleteCount > 0
  }
}

// v1.18.0: TODOS los nadadores tardíos con su estado (Aprobado / Rechazado / Pendiente), para
// que el admin siga viendo una tardía revisada, incluidos los rechazados. roster[i] ↔
// athletes[i] (Ath_no posicional). `decided` = cuántos tienen decisión.
export function lateReviewView(late) {
  const athletes = late?.athletes || []
  const roster = late?.roster || []
  const rows = athletes.map((athlete, index) => ({
    ...(roster[index] || { id: `late-${athlete.Ath_no}`, lastName: athlete.Last_name, firstName: athlete.First_name, sex: athlete.Ath_Sex, age: athlete.Ath_age, events: [] }),
    decision: athleteDecision(late, athlete.Ath_no)
  }))
  return { rows, decided: rows.filter((row) => row.decision !== 'pending').length }
}
