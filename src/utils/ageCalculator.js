export const CATEGORIES = [[3, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 18]]

export function calculateAge(birthDate, referenceDate) {
  if (!birthDate || !referenceDate) return null
  const birth = new Date(`${birthDate}T12:00:00`)
  const reference = new Date(`${referenceDate}T12:00:00`)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) return null
  let age = reference.getFullYear() - birth.getFullYear()
  if (reference.getMonth() < birth.getMonth() || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age--
  return age
}

export function categoryForAge(age, ranges = CATEGORIES) {
  const range = ranges.find(([min, max]) => age >= min && age <= max)
  return range ? { min: range[0], max: range[1], label: `${range[0]}-${range[1]} Años` } : null
}

export function birthDateBounds(categories, referenceDate) {
  if (!categories?.length || !referenceDate) return null
  const refYear = new Date(`${referenceDate}T12:00:00`).getFullYear()
  const minAge = Math.min(...categories.map(([lo]) => lo))
  const maxAge = Math.max(...categories.map(([, hi]) => hi))
  return { min: `${refYear - maxAge}-01-01`, max: `${refYear - minAge}-12-31` }
}
