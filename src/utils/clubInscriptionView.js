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
