// v1.21.1 — Textos de confirmación al agregar o editar nadadores en el wizard.
// En el iPhone el formulario se vaciaba sin ninguna señal: parecía que no había hecho nada.

export const ADD_FEEDBACK_MS = 8000
const MAX_EVENTS_SHOWN = 3

const athletes = (count) => `${count} ${count === 1 ? 'nadador' : 'nadadores'}`
const listName = (isLate) => (isLate ? 'la lista de tardías' : 'la lista')

// "50m Libre, 100m Espalda, 50m Pecho y 2 más"
export function eventsSummary(events = []) {
  const labels = events.map((event) => event.label).filter(Boolean)
  const shown = labels.slice(0, MAX_EVENTS_SHOWN).join(', ')
  const rest = labels.length - MAX_EVENTS_SHOWN
  return rest > 0 ? `${shown} y ${rest} más` : shown
}

export function addedText(athlete, count, isLate = false) {
  const summary = eventsSummary(athlete.events)
  return `✓ Agregaste a ${athlete.lastName}, ${athlete.firstName}${summary ? ` (${summary})` : ''}. Ya tienes ${athletes(count)} en ${listName(isLate)}.`
}

export const editedText = (athlete) => `✓ Guardaste los cambios de ${athlete.lastName}, ${athlete.firstName}.`

// Importación del Registro experto. `skipped`: nadadores que ya estaban en la lista.
export function importedNotice(added, skipped = 0, isLate = false) {
  if (!added) return { kind: 'warning', text: 'No se agregó ningún nadador: ya estaban en la lista.' }
  const repeated = skipped ? ` ${skipped} ${skipped === 1 ? 'ya estaba y no se repitió' : 'ya estaban y no se repitieron'}.` : ''
  return { kind: 'success', text: `✓ Agregaste ${athletes(added)} a ${listName(isLate)}.${repeated}` }
}
