export default function EventStatusBanner({ event }) {
  if (event.status === 'accepting_late') return <div className="rounded-xl bg-warning-50 p-4 text-warning-800"><strong>Se aceptan tardías con aprobación.</strong> Las inscripciones regulares cerraron; este envío será revisado por el organizador.</div>
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success-50 p-3 text-sm text-success-800"><strong>● Inscripciones abiertas</strong><span>Fecha límite: {event.deadline ? new Date(`${event.deadline}T12:00:00`).toLocaleDateString('es-VE') : 'Sin fecha límite definida'}</span></div>
}
