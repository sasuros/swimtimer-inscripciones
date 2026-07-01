import { FileSpreadsheet, PencilLine } from 'lucide-react'

const METHODS = [
  { id: 'manual', title: 'Registro manual', description: 'Inscribe nadadores uno por uno. Ideal si tienes pocos nadadores.', action: 'Comenzar', Icon: PencilLine },
  { id: 'expert', title: 'Registro experto', description: 'Importa todos tus nadadores desde Excel o Google Sheets. Ideal si tienes muchos.', action: 'Importar archivo', Icon: FileSpreadsheet }
]

export default function RegistrationMethodSelector({ onSelect }) {
  return <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="registration-method-title">
    <h2 id="registration-method-title" className="sr-only">Elige cómo registrar a tus nadadores</h2>
    {METHODS.map(({ id, title, description, action, Icon }) => <article key={id} className="flex min-h-64 flex-col rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:border-brand-600">
      <Icon className="size-9 text-brand-600" />
      <h3 className="mt-4 text-lg font-extrabold uppercase tracking-wide text-brand-800">{title}</h3>
      <p className="mt-3 flex-1 text-slate-600">{description}</p>
      <button type="button" className={id === 'expert' ? 'btn-primary mt-5 w-full' : 'btn-secondary mt-5 w-full'} onClick={() => onSelect(id)}>{action}</button>
    </article>)}
  </section>
}
