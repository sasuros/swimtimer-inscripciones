// v1.19.2: un evento recibe inscripciones solo en estos estados. Fuera de ellos (draft,
// closed, archived) un enlace vigente lleva a la pantalla de "cerradas" o "todavía no
// abiertas", y el envío se rechaza con el mismo texto.
export const OPEN_STATUSES = ['active', 'accepting_late']

export const isRegistrationOpen = (status) => OPEN_STATUSES.includes(status)

export const CLOSED_TEXT = 'Las inscripciones para este evento están cerradas'
export const NOT_OPEN_YET_TEXT = 'Las inscripciones para este evento todavía no están abiertas.'

export const notOpenText = (status) => (status === 'draft' ? NOT_OPEN_YET_TEXT : CLOSED_TEXT)
