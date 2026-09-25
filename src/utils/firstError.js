// v1.19.0: a qué campo llevar al entrenador cuando toca "Inscribir nadador" con errores
// (mismo orden en que aparecen en pantalla). Devuelve el id del elemento, o null.
const FIELD_ORDER = [
  ['lastName', 'lastName'],
  ['firstName', 'firstName'],
  ['sex', 'sex'],
  ['birthDate', 'birthDate'],
  ['duplicate', 'lastName'],
  ['events', 'event-selection']
]

export function firstErrorId(errors, selectedEvents = []) {
  for (const [key, id] of FIELD_ORDER) if (errors[key]) return id
  const time = selectedEvents.find((index) => errors[`time-${index}`])
  return time === undefined ? null : `time-${time}`
}
