import { Mail, MessageCircle } from 'lucide-react'
import Logo from '../components/Logo'

export default function ClosedEvent({ event }) {
  const message = `Hola ${event.organizer || ''}, necesito información sobre las inscripciones de ${event.name}.`
  return <main className="mx-auto flex min-h-screen max-w-xl items-center p-4"><section className="card w-full p-8 text-center"><Logo className="size-32" showByline /><h1 className="mt-6 text-2xl font-extrabold">Las inscripciones están cerradas</h1><p className="mt-3 text-slate-500">Ya no se reciben inscripciones para {event.name}.</p><div className="mt-6 flex flex-wrap justify-center gap-2">{event.organizer_whatsapp && <a className="btn-primary inline-flex items-center gap-2" href={`https://wa.me/${event.organizer_whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Contactar por WhatsApp</a>}<a className="btn-secondary inline-flex items-center gap-2" href={`mailto:${event.contact || 'albertosuros@yahoo.com'}?subject=${encodeURIComponent(`Inscripciones - ${event.name}`)}&body=${encodeURIComponent(message)}`}><Mail className="size-4" />Enviar correo</a></div></section></main>
}
