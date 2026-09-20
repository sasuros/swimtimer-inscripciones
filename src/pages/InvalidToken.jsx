import { Link2Off } from 'lucide-react'
import Logo from '../components/Logo'

export default function InvalidToken({ networkError, noToken }) {
  const message = networkError
    ? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
    : noToken
    ? 'Solicita al organizador el enlace único de tu club para acceder a la inscripción.'
    : 'Este enlace no es válido o ya expiró. Contacta al organizador del evento.'
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-4"><section className="card w-full p-8 text-center"><Logo className="size-32" showByline variant="color" /><Link2Off className="mx-auto mt-6 size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold text-brand-800">Necesitas un enlace de invitación</h1><p className="mt-2 text-slate-600">{message}</p><a className="mt-5 inline-block font-semibold text-brand-600" href="mailto:albertosuros@yahoo.com">albertosuros@yahoo.com</a></section></main>
}
