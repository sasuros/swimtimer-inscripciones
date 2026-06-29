import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

export default function RosterPanel({ roster, onEdit, onDelete, highlightId }) {
  const [open, setOpen] = useState(true)
  const total = roster.reduce((sum, athlete) => sum + athlete.events.length, 0)
  return <section className="card overflow-hidden">
    <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
      <div><h2 className="font-bold">Lista de nadadores del club</h2><p className="text-sm text-slate-500">{roster.length} nadadores · {total} inscripciones</p></div>
      <ChevronDown className={`size-5 transition ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="border-t">
      {!roster.length ? <p className="px-4 py-6 text-center text-sm text-slate-500">Aún no has inscrito nadadores</p> : roster.map((athlete, index) => <div key={athlete.id} className={`flex items-center gap-3 border-b px-4 py-3 last:border-0 transition ${highlightId === athlete.id ? 'bg-success-50' : ''}`}>
        <span className="w-6 text-sm font-bold text-slate-400">{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{athlete.lastName}, {athlete.firstName}</p><p className="text-xs text-slate-500">{athlete.events.length} eventos · {athlete.category.label}</p></div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${athlete.sex === 'F' ? 'bg-female-50 text-female-800' : 'bg-male-50 text-male-800'}`}>{athlete.sex}</span>
        <button type="button" aria-label={`Editar a ${athlete.firstName}`} onClick={() => onEdit(athlete)} className="rounded p-2 hover:bg-slate-100"><Pencil className="size-4" /></button>
        <button type="button" aria-label={`Eliminar a ${athlete.firstName}`} onClick={() => onDelete(athlete)} className="rounded p-2 text-danger-700 hover:bg-danger-50"><Trash2 className="size-4" /></button>
      </div>)}
    </div>}
  </section>
}
