import { CheckCircle2 } from 'lucide-react'

export default function ConfirmationScreen({ data }) {
  return <main className="mx-auto flex min-h-screen max-w-xl items-center p-4"><section className="card w-full p-6 text-center sm:p-10"><CheckCircle2 className="mx-auto size-16 text-success-800" /><h1 className="mt-4 text-2xl font-extrabold uppercase text-brand-800">Inscripción enviada</h1><p className="mt-3 text-slate-600"><strong>{data.meta.athlete_count} nadadores</strong> y <strong>{data.meta.inscription_count} inscripciones</strong> fueron recibidas correctamente.</p><p className="mt-6 text-sm text-slate-500">Tu inscripción fue recibida. Puedes cerrar esta página.</p></section></main>
}
