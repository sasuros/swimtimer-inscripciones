import { useEffect, useState } from 'react'
import { BarChart3, CalendarDays, ExternalLink, MapPin, ScanLine, Waves } from 'lucide-react'
import Logo from '../components/Logo'
import { getPublicEvents } from '../services/publicEvents'
import { formatPublicEventDate } from '../utils/publicEventDate'

export default function PublicLanding() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  useEffect(() => {
    document.title = 'SWIMTIMER · Resultados en vivo'
    getPublicEvents().then(setEvents).catch(error => setMessage(error.message)).finally(() => setLoading(false))
  }, [])

  return <div className="min-h-screen bg-[#F0F2F5]">
    <section className="flex min-h-[60vh] items-center bg-[linear-gradient(145deg,#1B3A5C,#0F2A47)] px-4 py-16 text-center text-white sm:min-h-[520px]"><div className="mx-auto max-w-3xl"><Logo className="h-24 w-24 sm:h-28 sm:w-28" /><p className="mt-2 text-xs font-bold tracking-[.28em] text-slate-300">BY SCANLEADS</p><h1 className="mt-8 text-4xl font-black leading-tight text-white sm:text-6xl">Resultados oficiales<br />en tiempo real</h1><p className="mx-auto mt-5 max-w-xl text-lg text-slate-200">Validados por la mesa técnica del evento.<br />Sin filas, sin esperar.</p><div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold"><span className="live-dot" aria-hidden="true" />Actualizado ahora</div></div></section>

    <main><section className="px-4 py-14 sm:py-20"><div className="mx-auto max-w-3xl"><p className="text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Resultados</p><h2 className="mt-2 text-3xl font-extrabold">Eventos</h2>{loading ? <LoadingCards /> : events.length ? <div className="mt-7 space-y-5">{events.map(event => <EventCard key={event.id} event={event} />)}</div> : <div className="card mt-7 p-8 text-center"><Waves className="mx-auto size-10 text-brand-600" /><p className="mt-4 font-bold text-brand-800">{message || 'No hay eventos activos en este momento.'}</p><p className="mt-2 text-sm text-slate-500">Los resultados estarán disponibles durante el evento.</p></div>}</div></section>

      <section className="bg-white px-4 py-14 sm:py-20"><div className="mx-auto max-w-5xl"><p className="text-center text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Simple y rápido</p><h2 className="mt-2 text-center text-3xl font-extrabold">¿Cómo funciona?</h2><div className="mt-9 grid gap-5 md:grid-cols-3"><HowStep number="1" icon={ScanLine} title="Escanea el QR">Encuentra el código en la cartelera del evento y ábrelo con tu teléfono.</HowStep><HowStep number="2" icon={Waves} title="Espera la serie">Al terminar cada serie, la mesa técnica valida y publica los resultados.</HowStep><HowStep number="3" icon={BarChart3} title="Ve tus tiempos">Los resultados oficiales aparecen aquí en segundos.</HowStep></div></div></section></main>

    <footer className="bg-[#1B3A5C] px-4 py-10 text-center text-white"><p className="text-xl font-extrabold tracking-widest">SWIMTIMER</p><p className="mt-1 text-xs tracking-[.25em] text-slate-300">BY SCANLEADS</p><p className="mt-5 text-sm text-slate-200">Sistema oficial de cronometraje y resultados</p><p className="mt-2 text-xs text-slate-400">© 2026 Scanleads · swimtimer-oficial.vercel.app</p></footer>
  </div>
}

function EventCard({ event }) {
  return <article className="card p-5 sm:p-7">{event.is_live ? <span className="live-badge"><span className="live-dot" aria-hidden="true" />En vivo</span> : <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">✓ Finalizado</span>}<h3 className="mt-4 text-xl font-extrabold sm:text-2xl">{event.name}</h3><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-600" />{formatPublicEventDate(event.date_start, event.date_end)}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />{event.venue || 'Sede por confirmar'}</p></div><a className={`${event.is_live ? 'btn-primary' : 'btn-secondary'} mt-6 inline-flex w-full items-center justify-center gap-2 py-3.5 text-center`} href={event.drive_url} target="_blank" rel="noopener noreferrer">{event.is_live ? 'Ver resultados oficiales' : 'Ver resultados'}<ExternalLink className="size-4" /></a></article>
}

function HowStep({ number, icon: Icon, title, children }) { return <article className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-6" /></span><p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-brand-600">Paso {number}</p><h3 className="mt-1 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p></article> }
function LoadingCards() { return <div className="mt-7 space-y-4" aria-label="Cargando eventos"><div className="h-56 animate-pulse rounded-lg bg-white" /><div className="h-56 animate-pulse rounded-lg bg-white" /></div> }
