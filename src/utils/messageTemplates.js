const displayDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-VE') : 'Sin fecha límite definida'

export function whatsappInvitation(event, url) {
  return `Hola, le saluda la organización de ${event.name}.\n\nYa están abiertas las inscripciones online para su equipo.\n\nAbra este enlace para inscribir a sus nadadores:\n${url}\n\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nCualquier duda, contactar a ${event.organizer || 'la organización'} por este mismo número.\n\nSWIMTIMER · Inscripciones by Scanleads`
}

export function emailInvitation(event, url) {
  const subject = `Inscripciones abiertas - ${event.name}`
  const body = `Estimado entrenador,\n\nLas inscripciones para ${event.name} ya están abiertas.\n\nIngrese al siguiente enlace para inscribir a sus nadadores:\n${url}\n\nFecha del evento: ${displayDate(event.date_start)}\nSede: ${event.venue || 'Por definir'}\nFecha límite de inscripción: ${displayDate(event.deadline)}\n\nAtentamente,\n${event.organizer || 'Organización del evento'}\nSWIMTIMER · Inscripciones by Scanleads`
  return { subject, body }
}

export function allLinksText(event, clubs, urlFor) {
  return `SWIMTIMER · Inscripciones\n${event.name}\n\n${clubs.filter(club => club.token).map(club => `${club.name}: ${urlFor(club.token)}`).join('\n')}`
}
