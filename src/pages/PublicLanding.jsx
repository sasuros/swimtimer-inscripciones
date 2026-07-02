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
  const totals = useMemo(() => events.filter(event => event.is_live === 'live').reduce((sum, event) => ({ athletes: sum.athletes + Number(event.athletes || 0), events: sum.events + Number(event.events || 0), teams: sum.teams + Number(event.teams || 0) }), { athletes: 0, events: 0, teams: 0 }), [events])
  const hasTotals = totals.athletes > 0 || totals.events > 0 || totals.teams > 0

  return <div className="min-h-screen bg-[#F0F2F5]">
    <section className="public-hero relative flex min-h-[70vh] items-center overflow-hidden px-4 pb-32 pt-16 text-center text-white sm:min-h-[65vh]"><Bubbles /><div className="relative z-10 mx-auto max-w-4xl"><div className="hero-stagger" style={{ '--stagger-delay': '0s' }}><Logo className="hero-logo h-24 w-24 sm:h-28 sm:w-28" /></div><p className="hero-stagger hero-byline mt-2 text-xs font-bold text-slate-300" style={{ '--stagger-delay': '.2s' }}>BY SCANLEADS</p><h1 className="public-hero-title hero-title mt-8 text-5xl font-black leading-[1.02] sm:text-6xl lg:text-[4rem]"><span className="hero-stagger block" style={{ '--stagger-delay': '.4s' }}>Resultados oficiales</span><span className="hero-stagger block" style={{ '--stagger-delay': '.6s' }}>en tiempo real</span></h1><p className="hero-stagger mx-auto mt-6 max-w-xl text-lg text-slate-200" style={{ '--stagger-delay': '.8s' }}>Validados por la mesa técnica del evento.<br />Sin filas, sin esperar.</p>{hasTotals && <div className="hero-stagger hero-counters mt-7 flex items-center justify-center gap-3 sm:gap-6" style={{ '--stagger-delay': '1s' }}><Counter value={totals.athletes} label="atletas" /><span className="counter-separator">·</span><Counter value={totals.events} label="pruebas" /><span className="counter-separator">·</span><Counter value={totals.teams} label="equipos" /></div>}<div className="hero-stagger updated-badge mt-7 inline-flex items-center gap-2 font-bold" style={{ '--stagger-delay': '1s' }}><span className="live-dot" aria-hidden="true" />Actualizado ahora</div></div><HeroWaves /></section>

    <main><section className="fade-section px-4 py-14 sm:py-20"><div className="mx-auto max-w-3xl"><p className="text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Resultados</p><h2 className="mt-2 text-3xl font-extrabold">Eventos</h2>{loading ? <LoadingCards /> : events.length ? <div className="mt-7 space-y-5">{events.map((event, index) => <EventCard key={event.id} event={event} index={index} />)}</div> : <div className="card mt-7 p-8 text-center"><Waves className="mx-auto size-10 text-brand-600" /><p className="mt-4 font-bold text-brand-800">{message || 'No hay eventos activos en este momento.'}</p><p className="mt-2 text-sm text-slate-500">Los resultados estarán disponibles durante el evento.</p></div>}</div></section>

      <section className="fade-section steps-section bg-white px-4 py-14 sm:py-20"><div className="mx-auto max-w-5xl"><p className="text-center text-sm font-extrabold uppercase tracking-[.24em] text-brand-600">Simple y rápido</p><h2 className="mt-2 text-center text-3xl font-extrabold">¿Cómo funciona?</h2><div className="steps-grid relative mt-12 grid gap-7 md:grid-cols-3"><svg className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] z-0 hidden h-2 w-[68%] md:block" viewBox="0 0 200 4" preserveAspectRatio="none" aria-hidden="true"><line className="connector-line" x1="0" y1="2" x2="200" y2="2" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5 5" /></svg><HowStep number="1" icon={ScanLine} title="Escanea el QR">Encuentra el código en la cartelera del evento y ábrelo con tu teléfono.</HowStep><HowStep number="2" icon={Waves} title="Espera la serie">Al terminar cada serie, la mesa técnica valida y publica los resultados.</HowStep><HowStep number="3" icon={BarChart3} title="Ve tus tiempos">Los resultados oficiales aparecen aquí en segundos.</HowStep></div></div></section></main>

    <footer className="fade-section public-footer relative bg-[#1B3A5C] px-4 pb-10 pt-24 text-center text-white"><FooterWave /><Logo className="h-14 w-14" /><p className="mt-2 text-xs tracking-[.25em] text-slate-300">BY SCANLEADS</p><p className="mt-5 text-sm text-slate-200">Sistema oficial de cronometraje y resultados</p><p className="mt-2 text-xs text-slate-400">© 2026 Scanleads</p></footer>
  </div>
}

function EventCard({ event, index }) {
  const [ripple, setRipple] = useState(null)
  const isLive = event.is_live === 'live'
  const isUpcoming = event.is_live === 'upcoming'
  const startRipple = pointer => { if (!isLive) return; const rect = pointer.currentTarget.getBoundingClientRect(); setRipple({ key: Date.now(), x: pointer.clientX - rect.left, y: pointer.clientY - rect.top }) }
  const buttonClass = isLive ? 'live-results-button' : isUpcoming ? 'upcoming-results-button' : 'finished-results-button'
  const buttonText = isLive ? 'Ver resultados oficiales' : isUpcoming ? 'Resultados disponibles pronto' : 'Ver resultados'
  const buttonContent = <>{buttonText}{event.drive_url && <ExternalLink className="arrow size-4" />}</>

  return <article className={`fade-section event-card ${isLive ? 'live-event-card' : isUpcoming ? 'upcoming-event-card' : 'finished-event-card'} relative overflow-hidden rounded-lg p-5 sm:p-7`} style={{ transitionDelay: `${index * .1}s` }} onPointerDown={startRipple}>
    {ripple && <span key={ripple.key} className="click-ripple" style={{ left: ripple.x, top: ripple.y }} aria-hidden="true" />}
    {isLive ? <span className="live-badge"><span className="live-dot" aria-hidden="true" />En vivo</span> : isUpcoming ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B3A5C] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"><CalendarDays className="size-3.5" />Próximamente</span> : <span className="inline-flex rounded-full bg-[#6B7280] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">✓ Finalizado</span>}
    <h3 className="mt-4 text-xl font-extrabold sm:text-2xl">{event.name}</h3>
    <div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-600" />{formatPublicEventDate(event.date_start, event.date_end)}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />{event.venue || 'Sede por confirmar'}</p></div>
    {event.drive_url ? <a className={`btn-results ${buttonClass} mt-6 inline-flex w-full items-center justify-center gap-2 text-center`} href={event.drive_url} target="_blank" rel="noopener noreferrer">{buttonContent}</a> : <span className={`btn-results ${buttonClass} mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 text-center opacity-75`} aria-disabled="true">{buttonContent}</span>}
  </article>
}

function HowStep({ number, icon: Icon, title, children }) { return <article className="fade-section how-step relative rounded-xl border border-slate-200 bg-slate-50 p-6 pt-9 text-center" style={{ '--step-delay': `${(Number(number) - 1) * .15}s` }}><span className="absolute -top-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">{number}</span><span className="step-icon mx-auto flex size-20 items-center justify-center rounded-full bg-[#ECFDF5] text-brand-600"><Icon className="size-12" /></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p></article> }
function Counter({ value, label }) { const current = useCountUp(value); return <span className="counter-group"><strong>{current}</strong><small>{label}</small></span> }
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
function HeroWaves() { return <div className="hero-waves pointer-events-none absolute inset-x-0 bottom-0 h-28" aria-hidden="true"><svg className="hero-wave hero-wave-back" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="rgba(255,255,255,.04)" d="M0,48 C250,105 430,10 720,52 C1010,96 1200,16 1440,52 L1440,120 L0,120 Z" /></svg><svg className="hero-wave hero-wave-mid" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="rgba(255,255,255,.08)" d="M0,62 C220,18 470,106 740,60 C1010,12 1220,100 1440,55 L1440,120 L0,120 Z" /></svg><svg className="hero-wave hero-wave-front" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="rgba(255,255,255,.15)" d="M0,78 C260,28 460,112 760,68 C1060,20 1230,102 1440,60 L1440,120 L0,120 Z" /></svg><svg className="absolute inset-x-0 bottom-0 h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="#F0F2F5" d="M0,62 C300,20 520,88 820,52 C1100,18 1280,62 1440,40 L1440,80 L0,80 Z" /></svg></div> }
function FooterWave() { return <><svg className="absolute inset-x-0 top-0 h-16 w-full -translate-y-px" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path fill="#fff" d="M0,0 H1440 V18 C1160,68 980,0 700,38 C400,78 230,10 0,45 Z" /></svg><FooterParticles /></> }
const BUBBLE_DATA = [[6,12,9,0,.06],[12,22,12,2,.08],[18,9,7,5,.05],[24,34,14,1,.07],[31,16,10,7,.09],[38,26,13,3,.06],[45,11,8,6,.08],[51,40,14,4,.05],[58,19,11,1,.1],[64,29,13,8,.06],[70,8,6,3,.08],[76,24,10,5,.07],[82,36,14,2,.05],[88,14,9,7,.09],[94,27,12,4,.06],[16,31,13,8,.04],[55,13,7,2,.08],[35,21,11,6,.07]]
function Bubbles() { return <div className="bubble-field pointer-events-none absolute inset-0" aria-hidden="true">{BUBBLE_DATA.map(([left, size, duration, delay, opacity], index) => <span key={index} className="bubble" style={{ left: `${left}%`, width: size, height: size, '--bubble-duration': `${duration}s`, '--bubble-delay': `${delay}s`, '--bubble-opacity': opacity }} />)}</div> }
const PARTICLES = [[8,25,2,0],[17,68,3,1.2],[27,42,2,2.4],[36,82,2,3.1],[45,22,3,.8],[55,65,2,2],[63,38,3,3.6],[72,78,2,1.6],[81,30,2,2.8],[90,60,3,.4],[22,15,2,3.9],[68,12,2,1.1]]
function FooterParticles() { return <div className="pointer-events-none absolute inset-0" aria-hidden="true">{PARTICLES.map(([left, top, size, delay], index) => <span key={index} className="footer-particle" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, '--particle-delay': `${delay}s` }} />)}</div> }
function LoadingCards() { return <div className="mt-7 space-y-4" aria-label="Cargando eventos"><div className="h-56 animate-pulse rounded-lg bg-white" /><div className="h-56 animate-pulse rounded-lg bg-white" /></div> }
