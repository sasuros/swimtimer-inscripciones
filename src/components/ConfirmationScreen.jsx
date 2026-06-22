import { CheckCircle2, Download } from 'lucide-react'
import { downloadJson } from '../utils/download'
import WhatsAppButton from './WhatsAppButton'

export default function ConfirmationScreen({ data, club, whatsapp }) {
  return <main className="mx-auto flex min-h-screen max-w-xl items-center p-4"><section className="card w-full p-6 text-center sm:p-10"><CheckCircle2 className="mx-auto size-16 text-brand-600" /><h1 className="mt-4 text-2xl font-bold">Inscripción enviada</h1><p className="mt-2 text-slate-600"><strong>{data.meta.athlete_count} nadadores</strong> y <strong>{data.meta.inscription_count} inscripciones</strong> fueron recibidas correctamente.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button className="btn-secondary inline-flex items-center gap-2" onClick={() => downloadJson(data, `inscripcion-${club.code}.json`)}><Download className="size-4" />Descargar .json</button><WhatsAppButton club={club} athletes={data.meta.athlete_count} inscriptions={data.meta.inscription_count} number={whatsapp} /></div><p className="mt-6 text-sm text-slate-500">Tu inscripción fue recibida. Puedes cerrar esta página.</p></section></main>
}
