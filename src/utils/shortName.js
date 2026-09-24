// Nombre corto para los archivos que se importan en Meet Manager.
// Solo se usa al generar esos archivos: la base y las vistas conservan el nombre completo.
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa'])

const words = value => String(value ?? '').trim().split(/\s+/).filter(Boolean)
const isParticle = word => PARTICLES.has(word.toLocaleLowerCase('es'))

export function shortLastName(value) {
  const parts = words(value)
  const firstReal = parts.findIndex(word => !isParticle(word))
  if (firstReal === -1) return parts.join(' ')
  return parts.slice(0, firstReal + 1).join(' ')
}

export function shortFirstName(value) {
  const [first, ...rest] = words(value)
  if (!first) return ''
  const next = rest.find(word => !isParticle(word))
  return next ? `${first} ${[...next][0]}.` : first
}

export const shortenAthlete = athlete => ({ ...athlete, Last_name: shortLastName(athlete.Last_name), First_name: shortFirstName(athlete.First_name) })
