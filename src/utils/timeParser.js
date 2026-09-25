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

// v1.19.0 — Tiempos en el móvil. Solo el wizard usa lo que sigue; el modo experto (CSV)
// sigue con formatTimeInput/validateTime tal cual (su versión tolerante es otro sprint).

// NT = "sin tiempo". "00.00" es el único NT probado de punta a punta (web → SD3 → MM).
export const NO_TIME = '00.00'
// Piso de plausibilidad: más rápido que esto es casi seguro un error de tipeo.
// Por debajo del récord mundial en todas las pruebas. Ajustable aquí y solo aquí.
export const SECONDS_PER_25M_FLOOR = 10

// Entrada del wizard, con teclado de solo dígitos. Invariante: todo lo que formatTimeInput
// ya deja válido sale IDÉNTICO (separadores, 4 a 6 dígitos, "0000" → "00.00"). Solo se
// extienden las entradas de 1 a 3 dígitos, que hoy son inválidas: solo ceros → NT; el
// resto se lee de derecha a izquierda (2 últimos = centésimas): "158" → "1.58".
export function formatWizardTime(value) {
  const legacy = formatTimeInput(String(value ?? ''))
  if (!validateTime(legacy) || !/^\d{1,3}$/.test(legacy)) return legacy
  if (/^0+$/.test(legacy)) return NO_TIME
  const digits = legacy.padStart(3, '0')
  return `${Number(digits.slice(0, -2))}.${digits.slice(-2)}`
}

export function timeToSeconds(value) {
  if (validateTime(value)) return null
  const [minutes, seconds] = value.includes(':') ? value.split(':') : ['0', value]
  return Number(minutes) * 60 + Number(seconds)
}

// Aviso (no bloquea) si el tiempo es más rápido que el piso para la distancia. El NT no avisa.
// Si el tiempo salió de 1 a 3 dígitos y agregarle "00" da una lectura válida y plausible,
// la sugiere: "158" (1.58) → "15800" (1:58.00).
export function plausibilityWarning(value, distance) {
  const seconds = timeToSeconds(value)
  const meters = Number(distance)
  if (!seconds || !meters) return ''
  if (seconds >= (meters / 25) * SECONDS_PER_25M_FLOOR) return ''
  const base = `¿Seguro? ${value} s es muy rápido para ${meters} m.`
  const typed = value.replace(/\D/g, '').replace(/^0+/, '')
  if (typed.length >= 1 && typed.length <= 3) {
    const suggestion = formatWizardTime(`${typed}00`)
    const suggestedSeconds = timeToSeconds(suggestion)
    if (suggestedSeconds && suggestedSeconds >= (meters / 25) * SECONDS_PER_25M_FLOOR) return `${base} Si quisiste decir ${suggestion}, escribe ${typed}00.`
  }
  return `${base} Revisa el tiempo.`
}
