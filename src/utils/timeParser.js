export const TIME_REGEX = /^(?:\d{1,2}:\d{2}|\d{1,2})\.\d{2}$/

export function formatTimeInput(value) {
  const clean = value.trim()
  if (/^\d{4}$/.test(clean)) return `${clean.slice(0, 2)}.${clean.slice(2)}`
  if (/^\d{5,6}$/.test(clean)) return `${clean.slice(0, -4)}:${clean.slice(-4, -2)}.${clean.slice(-2)}`
  return clean
}

export function validateTime(value) {
  if (!value) return 'Escribe el tiempo de inscripción'
  if (/\.\d$/.test(value)) return 'El tiempo debe tener centésimas: en vez de 32.5, escribe 32.50'
  if (!TIME_REGEX.test(value)) return 'El formato debe ser MM:SS.CC o SS.CC — ejemplo: 1:25.30'
  const parts = value.split(':')
  const seconds = Number(parts.at(-1).split('.')[0])
  if (parts.length === 2 && seconds >= 60) return 'Los segundos deben estar entre 00 y 59'
  return ''
}
