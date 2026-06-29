import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export default function LateReviewPanel({ submissions, onReview }) {
  const pending = submissions.filter(item => ['pending','partially_approved'].includes(item.status))
  if (!pending.length) return null
  return <section className="card overflow-hidden"><div className="border-b p-4"><h2 className="font-bold text-warning-800">Inscripciones tardías pendientes</h2><p className="text-sm text-slate-500">{pending.length} clubes requieren revisión</p></div>{pending.map(item => <LateRow key={`${item.eventId}-${item.club.code}`} item={item} onReview={onReview} />)}</section>
}

function LateRow({ item, onReview }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  return <div className="border-b p-4 last:border-0"><button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(!open)}><div className="flex-1"><p className="font-bold">{item.club.name}</p><p className="text-sm text-slate-500">{item.athletes.length} nadadores · {new Date(item.submitted_at).toLocaleString('es-VE')}</p></div><span className="rounded-full bg-warning-50 px-2 py-1 text-xs text-warning-800">{item.status === 'pending' ? 'Pendiente' : 'Parcial'}</span><ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="mt-4"><div className="space-y-2">{item.athletes.map(athlete => <label key={athlete.Ath_no} className="flex items-center gap-3 rounded-lg bg-slate-100 p-3"><input type="checkbox" checked={selected.includes(athlete.Ath_no)} onChange={() => toggle(athlete.Ath_no)} /><span className="flex-1">{athlete.Last_name}, {athlete.First_name}</span><span className="text-xs text-slate-500">{athlete.Ath_Sex} · {athlete.Ath_age} años</span></label>)}</div><div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary inline-flex items-center gap-2 text-sm" disabled={!selected.length} onClick={() => onReview(item.club.code, 'approve', selected)}><Check className="size-4" />Aprobar seleccionados</button><button className="btn-secondary text-sm" onClick={() => onReview(item.club.code, 'approve_all', [])}>Aprobar todos</button><button className="btn-secondary inline-flex items-center gap-2 text-sm text-danger-700" disabled={!selected.length} onClick={() => onReview(item.club.code, 'reject', selected)}><X className="size-4" />Rechazar seleccionados</button></div></div>}</div>
}
