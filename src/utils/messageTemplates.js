const displayDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-VE') : 'Sin fecha límite definida'

// v1.16.0: todo enlace de inscripción pide PIN, así que cada mensaje lo incluye.
const pinLine = pin => pin ? `\nCódigo de acceso (PIN): ${pin}\n` : ''

export function whatsappInvitation(event, url, pin) {
  return `Hola, le saluda la organización de ${event.name}.\n\nYa están abiertas las inscripciones online para su equipo.\n\nAbra este enlace para inscribir a sus nadadores:\n${url}\n${pinLine(pin)}\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nCualquier duda, contactar a ${event.organizer || 'la organización'} por este mismo número.\n\nSWIMTIMER · Inscripciones by Scanleads`
}

export function emailInvitation(event, url, pin) {
  const subject = `Inscripciones abiertas - ${event.name}`
  const body = `Estimado entrenador,\n\nLas inscripciones para ${event.name} ya están abiertas.\n\nIngrese al siguiente enlace para inscribir a sus nadadores:\n${url}\n${pinLine(pin)}\nFecha del evento: ${displayDate(event.date_start)}\nSede: ${event.venue || 'Por definir'}\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nAtentamente,\n${event.organizer || 'Organización del evento'}\nSWIMTIMER · Inscripciones by Scanleads`
  return { subject, body }
}

// Línea de un club: "Club: URL · PIN: 1234". La usan "Copiar enlace" y "Copiar todos".
export function clubLinkText(club, url) {
  return `${club.name}: ${url}${club.pin ? ` · PIN: ${club.pin}` : ''}`
}

export function allLinksText(event, clubs, urlFor) {
  return `SWIMTIMER · Inscripciones\n${event.name}\n\n${clubs.filter(club => club.token).map(club => clubLinkText(club, urlFor(club.token))).join('\n')}`
}
