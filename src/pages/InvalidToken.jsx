import { Link2Off } from 'lucide-react'
import Logo from '../components/Logo'
import OrganizerContact from '../components/OrganizerContact'
import { DEMO_WHATSAPP } from '../config'

// v1.19.2: un enlace reemplazado por "Reenviar invitación" (o revocado) es indistinguible de
// uno mal copiado, así que el texto cubre los dos casos. Sin evento conocido, el contacto es
// el global: WhatsApp de VITE_ALBERTO_WHATSAPP (solo si es un número real) y el correo.
export const INVALID_LINK_TEXT = 'Este enlace no es válido o fue reemplazado por uno más reciente. Revisa el último correo de invitación o escríbele al organizador.'
const CONTACT_EMAIL = 'albertosuros@yahoo.com'
const CONTACT_MESSAGE = 'Hola, necesito ayuda con mi enlace de inscripción de SWIMTIMER.'

export default function InvalidToken({ networkError, noToken, whatsapp = DEMO_WHATSAPP }) {
  const message = networkError
    ? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
    : noToken
    ? 'Solicita al organizador el enlace único de tu club para acceder a la inscripción.'
    : INVALID_LINK_TEXT
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-4"><section className="card w-full p-8 text-center"><Logo className="size-32" showByline variant="color" /><Link2Off className="mx-auto mt-6 size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold text-brand-800">Necesitas un enlace de invitación</h1><p className="mt-2 text-slate-600">{message}</p><OrganizerContact whatsapp={whatsapp} email={CONTACT_EMAIL} subject="Enlace de inscripción" message={CONTACT_MESSAGE} /></section></main>
}
