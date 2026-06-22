import { Link2Off } from 'lucide-react'

export default function InvalidToken({ networkError }) {
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-4"><section className="card w-full p-8 text-center"><img src="/logo.svg" alt="SWIMTIMER" className="mx-auto size-14" /><Link2Off className="mx-auto mt-6 size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Necesitas un enlace de invitación</h1><p className="mt-2 text-slate-600">{networkError ? 'No pudimos validar el enlace. Revisa tu conexión e inténtalo de nuevo.' : 'Solicita al organizador el enlace único de tu club para acceder a la inscripción.'}</p><a className="mt-5 inline-block font-semibold text-brand-600" href="mailto:albertosuros@yahoo.com">albertosuros@yahoo.com</a></section></main>
}
