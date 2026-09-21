export function deriveRosterView(access) {
  const isLate = access.event.status === 'accepting_late'
  return {
    isLate,
    locked: isLate ? access.normal_inscription?.roster || [] : [],
    editableInitial: access.inscription?.roster || []
  }
}
