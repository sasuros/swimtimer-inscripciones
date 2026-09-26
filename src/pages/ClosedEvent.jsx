import Logo from '../components/Logo'
import OrganizerContact from '../components/OrganizerContact'
import { NOT_OPEN_YET_TEXT } from '../utils/registrationStatus'

// Enlace vigente de un evento que no recibe inscripciones. v1.19.2: en borrador (draft)
// todavía no abrieron; "cerradas" queda para closed y archived.
export default function ClosedEvent({ event }) {
  const message = `Hola ${event.organizer || ''}, necesito información sobre las inscripciones de ${event.name}.`
  const notYet = event.status === 'draft'
  return <main className="mx-auto flex min-h-screen max-w-xl items-center p-4"><section className="card w-full p-8 text-center"><Logo className="size-32" showByline variant="color" /><h1 className="mt-6 text-2xl font-extrabold">{notYet ? NOT_OPEN_YET_TEXT : 'Las inscripciones están cerradas'}</h1><p className="mt-3 text-slate-500">{notYet ? event.name : `Ya no se reciben inscripciones para ${event.name}.`}</p><OrganizerContact whatsapp={event.organizer_whatsapp} email={event.contact || 'albertosuros@yahoo.com'} subject={`Inscripciones - ${event.name}`} message={message} /></section></main>
}
