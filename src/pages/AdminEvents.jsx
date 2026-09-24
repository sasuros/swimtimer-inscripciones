import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, Copy, FileUp, MapPin, Plus, QrCode, Trash2 } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'
import DeleteEventModal from '../components/DeleteEventModal'
import { deleteEvent, listEvents, updateEventStatus } from '../services/api'
import { downloadEventQr } from '../utils/eventQr'

const todayCaracas = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())

const statusInfo = {
  active: ['Recibiendo inscripciones', 'bg-success-solid text-white'],
  accepting_late: ['Aceptando tardías', 'bg-warning-bg text-warning-fg'],
  draft: ['Próximamente', 'bg-warning-bg text-warning-fg'],
  closed: ['Inscripciones cerradas', 'bg-surface-alt text-ink-soft'],
  archived: ['Archivado', 'bg-surface-alt text-ink-muted']
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
  const downloadQr = event => downloadEventQr(event).catch(error => setError(error.message))
  const deleteButton = event => <button className="rounded-lg border border-danger-fg p-2.5 text-danger-fg transition hover:bg-danger-bg" onClick={() => setDeletingEvent(event)} aria-label={`Eliminar ${event.name}`} title="Eliminar evento"><Trash2 className="size-4" /></button>
  const qrButton = event => <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={() => downloadQr(event)} title="Descargar QR" aria-label={`Descargar QR de ${event.name}`}><QrCode className="size-4" /><span>QR</span></button>
  const today = todayCaracas()
  const eventCutoffDate = event => event.date_end || event.date_start
  const active = events.filter(event => ['active', 'accepting_late'].includes(event.status))
  const past = events.filter(event => !['active', 'accepting_late'].includes(event.status) && (event.status === 'archived' || (eventCutoffDate(event) && eventCutoffDate(event) < today)))
  const upcoming = events.filter(event => !active.includes(event) && !past.includes(event))
  return <><AdminHeader /><main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-ink-strong">Panel del organizador</p><h1 className="mt-1 text-3xl font-extrabold">Mis eventos</h1><p className="mt-1 text-ink-muted">Meet Manager es la fuente principal de configuración.</p></div><div className="flex flex-wrap gap-2"><a className="btn-primary inline-flex items-center gap-2 px-5 py-3" href="/admin/eventos/importar"><FileUp className="size-5" />Importar desde Meet Manager</a><a className="btn-secondary inline-flex items-center gap-2" href="/admin/eventos/nuevo"><Plus className="size-4" />Crear manualmente</a></div></div>
    {error && <p className="rounded-lg bg-danger-bg p-3 text-danger-fg">{error}</p>}
    <EventSection title="Eventos activos" empty="No hay eventos recibiendo inscripciones.">{active.map(event => <EventCard key={event.id} event={event} action={<a className="btn-secondary text-sm" href={`/admin/eventos/${event.id}`}>Abrir evento</a>} qrAction={qrButton(event)} />)}</EventSection>
    <EventSection title="Próximos eventos" empty="No hay eventos próximos.">{upcoming.map(event => <EventCard key={event.id} event={event} action={event.status === 'draft' ? <div className="flex gap-2"><button className="btn-secondary text-sm" onClick={() => setStatus(event.id, 'active')}>Activar</button>{deleteButton(event)}</div> : <div className="flex gap-2"><a className="btn-secondary text-sm" href={`/admin/eventos/${event.id}`}>Abrir evento</a>{deleteButton(event)}</div>} qrAction={qrButton(event)} />)}</EventSection>
    <section className="card overflow-hidden"><button className="flex w-full items-center justify-between p-5 text-left" onClick={() => setPastOpen(!pastOpen)}><div><h2 className="text-xl font-bold">Eventos pasados</h2><p className="text-sm text-ink-muted">{past.length} eventos que ya pasaron</p></div><ChevronDown className={`transition ${pastOpen ? 'rotate-180' : ''}`} /></button>{pastOpen && <div className="border-t">{past.length ? past.map(event => <div key={event.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0"><div className="min-w-64 flex-1"><p className="font-bold">{event.name}</p><p className="text-sm text-ink-muted">{formatDate(event.date_start)} · {event.progress.athletes} nadadores</p></div><a className="btn-secondary text-sm" href={`/admin/eventos/${event.id}`}>Abrir evento</a>{qrButton(event)}<a className="btn-secondary inline-flex items-center gap-2 text-sm" href={`/admin/eventos/clonar/${event.id}`}><Copy className="size-4" />Clonar</a>{deleteButton(event)}</div>) : <p className="p-5 text-ink-muted">Todavía no hay eventos pasados.</p>}</div>}</section>
  </main>{deletingEvent && <DeleteEventModal event={deletingEvent} onClose={() => setDeletingEvent(null)} onConfirm={remove} />}</>
}

function EventSection({ title, empty, children }) { return <section><h2 className="mb-3 text-xl font-bold">{title}</h2><div className="grid gap-4 lg:grid-cols-2">{children.length ? children : <div className="card p-6 text-ink-muted">{empty}</div>}</div></section> }
function EventCard({ event, action, qrAction }) {
  const progress = event.progress.clubs ? Math.round(event.progress.received / event.progress.clubs * 100) : 0
  return <article className="card p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusInfo[event.status][1]}`}>{statusInfo[event.status][0]}</span>
        <h3 className="mt-3 text-lg font-bold text-ink-strong"><a href={`/admin/eventos/${event.id}`}>{event.name}</a></h3>
      </div>
      <div className="hidden shrink-0 gap-2 sm:flex">{qrAction}{action}</div>
    </div>
    <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><CalendarDays className="size-4 shrink-0" />{formatDate(event.date_start)}</p>
    <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted"><MapPin className="size-4 shrink-0" />{event.venue || 'Sede por definir'}</p>
    <div className="mt-5 flex items-center justify-between text-xs"><span>{event.progress.received} de {event.progress.clubs} clubes</span><span>{progress}%</span></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-strong"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} /></div>
    <div className="mt-4 flex gap-2 sm:hidden">{qrAction}{action}</div>
  </article>
}
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha pendiente' }
