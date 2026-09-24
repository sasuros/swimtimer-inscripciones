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
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
    <section className="card w-full max-w-lg p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger-bg text-danger-fg"><Trash2 className="size-5" /></div><h2 id="delete-event-title" className="text-xl font-extrabold">¿Eliminar “{event.name}”?</h2></div><button className="rounded p-2 hover:bg-surface-alt" onClick={onClose} aria-label="Cerrar"><X /></button></div>
      <p className="mt-4 text-sm text-ink-soft">Esta acción eliminará el evento, todos los enlaces de acceso y todas las inscripciones asociadas. No se puede deshacer.</p>
      <label className="label mt-5" htmlFor="delete-confirmation">Escribe <strong>ELIMINAR</strong> para confirmar:</label>
      <input id="delete-confirmation" className="input" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" placeholder="Escribe ELIMINAR" autoFocus />
      <p className="field-help">La palabra debe coincidir exactamente, en mayúsculas.</p>
      {error && <p className="mt-3 rounded-lg bg-danger-bg p-3 text-sm text-danger-fg">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={onClose} disabled={deleting}>Cancelar</button><button className="btn-danger inline-flex items-center gap-2" onClick={remove} disabled={confirmation !== 'ELIMINAR' || deleting}><Trash2 className="size-4" />{deleting ? 'Eliminando…' : 'Eliminar permanentemente'}</button></div>
    </section>
  </div>
}
