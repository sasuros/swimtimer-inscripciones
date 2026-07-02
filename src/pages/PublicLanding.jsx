import { useEffect, useMemo, useState } from 'react'
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
  useEffect(() => {
    const elements = document.querySelectorAll('.fade-section')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { elements.forEach(element => element.classList.add('visible')); return undefined }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target) } }), { threshold: 0.1 })
    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [loading, events])
  const totals = useMemo(() => events.filter(event => event.is_live || event.status === 'active').reduce((sum, event) => ({ athletes: sum.athletes + Number(event.athletes || 0), events: sum.events + Number(event.events || 0), teams: sum.teams + Number(event.teams || 0) }), { athletes: 0, events: 0, teams: 0 }), [events])
  const hasTotals = totals.athletes > 0 || totals.events > 0 || totals.teams > 0

  return <div className="min-h-screen bg-[#F0F2F5]">
    <section className="public-hero relative flex min-h-[70vh] items-center overflow-hidden px-4 pb-28 pt-16 text-center text-white sm:min-h-[65vh]"><div className="relative z-10 mx-auto max-w-4xl"><Logo className="hero-logo h-24 w-24 sm:h-28 sm:w-28" /><p className="hero-byline mt-2 text-xs font-bold text-slate-300">BY SCANLEADS</p><h1 className="public-hero-title hero-title mt-8 text-5xl font-black leading-[1.02] sm:text-6xl lg:text-[4rem]">Resultados oficiales<br />en tiempo real</h1><p className="mx-auto mt-6 max-w-xl text-lg text-slate-200">Validados por la mesa técnica del evento.<br />Sin filas, sin esperar.</p>{hasTotals && <div className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-sm font-semibold tabular-nums text-white/70"><Counter value={totals.athletes} label="atletas" /><span>·</span><Counter value={totals.events} label="pruebas" /><span>·</span><Counter value={totals.teams} label="equipos" /></div>}<div className="updated-badge mt-7 inline-flex items-center gap-2 font-bold"><span className="live-dot" aria-hidden="true" />Actualizado ahora</div></div><HeroWaves /></section>

    <main><section className="fade-section px-4 py-14 sm:py-20"><div className="mx-auto max-w-3xl"><p className="text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Resultados</p><h2 className="mt-2 text-3xl font-extrabold">Eventos</h2>{loading ? <LoadingCards /> : events.length ? <div className="mt-7 space-y-5">{events.map((event, index) => <EventCard key={event.id} event={event} index={index} />)}</div> : <div className="card mt-7 p-8 text-center"><Waves className="mx-auto size-10 text-brand-600" /><p className="mt-4 font-bold text-brand-800">{message || 'No hay eventos activos en este momento.'}</p><p className="mt-2 text-sm text-slate-500">Los resultados estarán disponibles durante el evento.</p></div>}</div></section>

      <section className="fade-section steps-section bg-white px-4 py-14 sm:py-20"><div className="mx-auto max-w-5xl"><p className="text-center text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Simple y rápido</p><h2 className="mt-2 text-center text-3xl font-extrabold">¿Cómo funciona?</h2><div className="steps-grid relative mt-12 grid gap-7 md:grid-cols-3"><svg className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] z-0 hidden h-2 w-[68%] md:block" viewBox="0 0 200 4" preserveAspectRatio="none" aria-hidden="true"><line className="connector-line" x1="0" y1="2" x2="200" y2="2" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5 5" /></svg><HowStep number="1" icon={ScanLine} title="Escanea el QR">Encuentra el código en la cartelera del evento y ábrelo con tu teléfono.</HowStep><HowStep number="2" icon={Waves} title="Espera la serie">Al terminar cada serie, la mesa técnica valida y publica los resultados.</HowStep><HowStep number="3" icon={BarChart3} title="Ve tus tiempos">Los resultados oficiales aparecen aquí en segundos.</HowStep></div></div></section></main>

    <footer className="fade-section public-footer relative bg-[#1B3A5C] px-4 pb-10 pt-24 text-center text-white"><FooterWave /><Logo className="h-14 w-14" /><p className="mt-2 text-xs tracking-[.25em] text-slate-300">BY SCANLEADS</p><p className="mt-5 text-sm text-slate-200">Sistema oficial de cronometraje y resultados</p><p className="mt-2 text-xs text-slate-400">© 2026 Scanleads</p></footer>
  </div>
}

function EventCard({ event, index }) {
  return <article className={`fade-section event-card ${event.is_live ? 'live-event-card' : 'finished-event-card'} rounded-lg p-5 sm:p-7`} style={{ transitionDelay: `${index * .1}s` }}>{event.is_live ? <span className="live-badge"><span className="live-dot" aria-hidden="true" />En vivo</span> : <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">✓ Finalizado</span>}<h3 className="mt-4 text-xl font-extrabold sm:text-2xl">{event.name}</h3><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-600" />{formatPublicEventDate(event.date_start, event.date_end)}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />{event.venue || 'Sede por confirmar'}</p></div><a className={`btn-results ${event.is_live ? 'live-results-button' : 'finished-results-button'} mt-6 inline-flex w-full items-center justify-center gap-2 text-center`} href={event.drive_url} target="_blank" rel="noopener noreferrer">{event.is_live ? 'Ver resultados oficiales' : 'Ver resultados'}<ExternalLink className="arrow size-4" /></a></article>
}

function HowStep({ number, icon: Icon, title, children }) { return <article className="fade-section how-step relative rounded-xl border border-slate-200 bg-slate-50 p-6 pt-9 text-center" style={{ '--step-delay': `${(Number(number) - 1) * .15}s` }}><span className="absolute -top-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">{number}</span><span className="step-icon mx-auto flex size-20 items-center justify-center rounded-full bg-[#ECFDF5] text-brand-600"><Icon className="size-12" /></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p></article> }
function Counter({ value, label }) { const current = useCountUp(value); return <span>{current} {label}</span> }
function useCountUp(target) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return undefined }
    let frame; const started = performance.now()
    const tick = now => { const progress = Math.min((now - started) / 1500, 1); setValue(Math.round(target * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}
function HeroWaves() { return <div className="hero-waves pointer-events-none absolute inset-x-0 bottom-0 h-24" aria-hidden="true"><svg className="hero-wave hero-wave-back" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="rgba(255,255,255,.07)" d="M0,55 C240,105 420,15 720,55 C1020,95 1200,20 1440,58 L1440,120 L0,120 Z" /></svg><svg className="hero-wave hero-wave-front" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="rgba(255,255,255,.13)" d="M0,76 C260,25 460,115 760,66 C1060,18 1230,100 1440,58 L1440,120 L0,120 Z" /></svg><svg className="absolute inset-x-0 bottom-0 h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="#F0F2F5" d="M0,62 C300,20 520,88 820,52 C1100,18 1280,62 1440,40 L1440,80 L0,80 Z" /></svg></div> }
function FooterWave() { return <svg className="absolute inset-x-0 top-0 h-16 w-full -translate-y-px" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path fill="#fff" d="M0,0 H1440 V18 C1160,68 980,0 700,38 C400,78 230,10 0,45 Z" /></svg> }
function LoadingCards() { return <div className="mt-7 space-y-4" aria-label="Cargando eventos"><div className="h-56 animate-pulse rounded-lg bg-white" /><div className="h-56 animate-pulse rounded-lg bg-white" /></div> }
