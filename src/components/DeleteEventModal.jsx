import { useState } from 'react'
import { Trash2, X } from 'lucide-react'

export default function DeleteEventModal({ event, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const remove = async () => {
    if (confirmation !== 'ELIMINAR') return
    setDeleting(true); setError('')
    try { await onConfirm(event.id) } catch (failure) { setError(failure.message); setDeleting(false) }
  }
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
    <section className="card w-full max-w-lg p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger-50 text-danger-700"><Trash2 className="size-5" /></div><h2 id="delete-event-title" className="text-xl font-extrabold">¿Eliminar “{event.name}”?</h2></div><button className="rounded p-2 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar"><X /></button></div>
      <p className="mt-4 text-sm text-slate-600">Esta acción eliminará el evento, todos los enlaces de acceso y todas las inscripciones asociadas. No se puede deshacer.</p>
      <label className="label mt-5" htmlFor="delete-confirmation">Escribe <strong>ELIMINAR</strong> para confirmar:</label>
      <input id="delete-confirmation" className="input" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" placeholder="Escribe ELIMINAR" autoFocus />
      <p className="field-help">La palabra debe coincidir exactamente, en mayúsculas.</p>
      {error && <p className="mt-3 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={onClose} disabled={deleting}>Cancelar</button><button className="inline-flex items-center gap-2 rounded-lg border border-danger-700 px-4 py-2.5 font-bold text-danger-700 transition hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={remove} disabled={confirmation !== 'ELIMINAR' || deleting}><Trash2 className="size-4" />{deleting ? 'Eliminando…' : 'Eliminar permanentemente'}</button></div>
    </section>
  </div>
}
