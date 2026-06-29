export function eventAllowsSex(eventSex, athleteSex) {
  const eventValue = String(eventSex ?? '').trim().toUpperCase()
  const athleteValue = String(athleteSex ?? '').trim().toUpperCase()
  return ['X', 'B'].includes(eventValue) || eventValue === athleteValue
}
