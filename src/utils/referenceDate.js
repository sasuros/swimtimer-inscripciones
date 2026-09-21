export function referenceDateFor(dateStart) {
  const year = new Date(`${dateStart}T12:00:00`).getFullYear()
  return `${year}-12-31`
}
