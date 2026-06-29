import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, Copy, FileUp, MapPin, Plus, Trash2 } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'
import DeleteEventModal from '../components/DeleteEventModal'
import { deleteEvent, listEvents, updateEventStatus } from '../services/api'

const statusInfo = {
  active: ['Recibiendo inscripciones', 'bg-success-50 text-success-800'],
  accepting_late: ['Aceptando tardías', 'bg-warning-50 text-warning-800'],
  draft: ['Próximamente', 'bg-warning-50 text-warning-800'],
  closed: ['Inscripciones cerradas', 'bg-slate-100 text-slate-600'],
  archived: ['Archivado', 'bg-slate-100 text-slate-500']
}

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [pastOpen, setPastOpen] = useState(false)
  const [error, setError] = useState('')
  const [deletingEvent, setDeletingEvent] = useState(null)
  const load = () => listEvents().then(setEvents).catch(error => setError(error.message))
  useEffect(() => { load() }, [])
  const setStatus = async (id, status) => { await updateEventStatus(id, status); load() }
  const remove = async id => { await deleteEvent(id); setDeletingEvent(null); await load() }
  const deleteButton = event => <button className="rounded-lg border border-danger-700 p-2.5 text-danger-700 transition hover:bg-danger-50" onClick={() => setDeletingEvent(event)} aria-label={`Eliminar ${event.name}`} title="Eliminar evento"><Trash2 className="size-4" /></button>
  const active = events.filter(event => ['active', 'accepting_late'].includes(event.status))
  const upcoming = events.filter(event => event.status === 'draft')
  const past = events.filter(event => ['closed', 'archived'].includes(event.status))
  return <><AdminHeader /><main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-brand-800">Panel del organizador</p><h1 className="mt-1 text-3xl font-extrabold">Mis eventos</h1><p className="mt-1 text-slate-500">Meet Manager es la fuente principal de configuración.</p></div><div className="flex flex-wrap gap-2"><a className="btn-secondary inline-flex items-center gap-2 text-sm" href={events[0] ? `/admin/eventos/clonar/${events[0].id}` : '/admin/eventos/nuevo'}><Copy className="size-4" />Clonar anterior</a><a className="btn-primary inline-flex items-center gap-2 px-5 py-3" href="/admin/eventos/importar"><FileUp className="size-5" />Importar desde Meet Manager</a><a className="btn-secondary inline-flex items-center gap-2" href="/admin/eventos/nuevo"><Plus className="size-4" />Crear manualmente</a></div></div>
    {error && <p className="rounded-lg bg-danger-50 p-3 text-danger-700">{error}</p>}
    <EventSection title="Eventos activos" empty="No hay eventos recibiendo inscripciones.">{active.map(event => <EventCard key={event.id} event={event} action={<a className="btn-secondary text-sm" href={`/admin/eventos/${event.id}`}>Gestionar</a>} />)}</EventSection>
    <EventSection title="Próximos eventos" empty="No hay borradores pendientes.">{upcoming.map(event => <EventCard key={event.id} event={event} action={<div className="flex gap-2"><button className="btn-secondary text-sm" onClick={() => setStatus(event.id, 'active')}>Activar</button>{deleteButton(event)}</div>} />)}</EventSection>
    <section className="card overflow-hidden"><button className="flex w-full items-center justify-between p-5 text-left" onClick={() => setPastOpen(!pastOpen)}><div><h2 className="text-xl font-bold">Eventos pasados</h2><p className="text-sm text-slate-500">{past.length} eventos cerrados o archivados</p></div><ChevronDown className={`transition ${pastOpen ? 'rotate-180' : ''}`} /></button>{pastOpen && <div className="border-t">{past.length ? past.map(event => <div key={event.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0"><div className="min-w-64 flex-1"><p className="font-bold">{event.name}</p><p className="text-sm text-slate-500">{formatDate(event.date_start)} · {event.progress.athletes} nadadores</p></div><a className="btn-secondary text-sm" href={`/admin/eventos/${event.id}`}>Ver detalle</a><a className="btn-secondary inline-flex items-center gap-2 text-sm" href={`/admin/eventos/clonar/${event.id}`}><Copy className="size-4" />Clonar</a>{deleteButton(event)}</div>) : <p className="p-5 text-slate-500">Todavía no hay eventos pasados.</p>}</div>}</section>
  </main>{deletingEvent && <DeleteEventModal event={deletingEvent} onClose={() => setDeletingEvent(null)} onConfirm={remove} />}</>
}

function EventSection({ title, empty, children }) { return <section><h2 className="mb-3 text-xl font-bold">{title}</h2><div className="grid gap-4 lg:grid-cols-2">{children.length ? children : <div className="card p-6 text-slate-500">{empty}</div>}</div></section> }
function EventCard({ event, action }) { const progress = event.progress.clubs ? Math.round(event.progress.received / event.progress.clubs * 100) : 0; return <article className="card p-5"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusInfo[event.status][1]}`}>{statusInfo[event.status][0]}</span><h3 className="mt-3 text-lg font-bold text-brand-800"><a href={`/admin/eventos/${event.id}`}>{event.name}</a></h3></div>{action}</div><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="size-4" />{formatDate(event.date_start)}</p><p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><MapPin className="size-4" />{event.venue}</p><div className="mt-5 flex items-center justify-between text-xs"><span>{event.progress.received} de {event.progress.clubs} clubes</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} /></div></article> }
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha pendiente' }
