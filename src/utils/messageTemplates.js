const displayDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-VE') : 'Sin fecha límite definida'

// v1.16.0: todo enlace de inscripción pide PIN, así que cada mensaje lo incluye.
const pinLine = pin => pin ? `\nCódigo de acceso (PIN): ${pin}\n` : ''

// v1.19.1: el mismo enlace sirve para volver; misma frase que el correo de invitación.
export const REOPEN_LINE = 'Puedes volver a abrir este enlace cuando quieras para agregar o corregir nadadores.'

export function whatsappInvitation(event, url, pin) {
  return `Hola, te saluda la organización de ${event.name}.\n\nYa están abiertas las inscripciones online para tu equipo.\n\nAbre este enlace para inscribir a tus nadadores:\n${url}\n${pinLine(pin)}\n${REOPEN_LINE}\n\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nSi tienes cualquier duda, escríbele a ${event.organizer || 'la organización'} por este mismo número.\n\nSWIMTIMER · Inscripciones by Scanleads`
}

export function emailInvitation(event, url, pin) {
  const subject = `Inscripciones abiertas - ${event.name}`
  const body = `Hola, entrenador:\n\nLas inscripciones para ${event.name} ya están abiertas.\n\nEntra al siguiente enlace para inscribir a tus nadadores:\n${url}\n${pinLine(pin)}\n${REOPEN_LINE}\n\nFecha del evento: ${displayDate(event.date_start)}\nSede: ${event.venue || 'Por definir'}\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nSaludos,\n${event.organizer || 'Organización del evento'}\nSWIMTIMER · Inscripciones by Scanleads`
  return { subject, body }
}

// Línea de un club: "Club: URL · PIN: 1234". La usan "Copiar enlace" y "Copiar todos".
export function clubLinkText(club, url) {
  return `${club.name}: ${url}${club.pin ? ` · PIN: ${club.pin}` : ''}`
}

export function allLinksText(event, clubs, urlFor) {
  return `SWIMTIMER · Inscripciones\n${event.name}\n\n${clubs.filter(club => club.token).map(club => clubLinkText(club, urlFor(club.token))).join('\n')}`
}
