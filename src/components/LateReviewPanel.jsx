import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { athleteDecision, needsReview, pendingAthletes } from '../services/lateDecision'
import { confirmText } from '../utils/lateReviewText'

// v1.18.0: las decisiones son finales (lateDecision.js). Solo se marcan pendientes, cada
// decisión pasa por un diálogo que nombra a los nadadores, y mientras una revisión está en
// vuelo (`busy`) no se puede lanzar otra.
export default function LateReviewPanel({ submissions, onReview, busy = false }) {
  const pending = submissions.filter(needsReview)
  if (!pending.length) return null
  return (
    <section className="card overflow-hidden">
      <div className="border-b p-4">
        <h2 className="font-bold text-warning-fg">Inscripciones tardías pendientes</h2>
        <p className="text-sm text-ink-muted">{pending.length} {pending.length === 1 ? 'club requiere' : 'clubes requieren'} revisión</p>
      </div>
      {pending.map((item) => (
        <LateRow key={`${item.eventId}-${item.club.code}`} item={item} onReview={onReview} busy={busy} />
      ))}
    </section>
  )
}

const DECISION_BADGE = {
  approved: ['bg-success-bg text-success-fg', 'Aprobado'],
  rejected: ['bg-danger-bg text-danger-fg', 'Rechazado']
}

function LateRow({ item, onReview, busy }) {
  const [open, setOpen] = useState(false)
  // La selección pertenece a UNA carga (versión): tras recargar no sobrevive, porque los
  // Ath_no son posicionales y podrían ser otros nadadores.
  const [selection, setSelection] = useState({ version: item.version, ids: [] })
  const [confirming, setConfirming] = useState(null)
  const pending = pendingAthletes(item)
  const pendingNos = pending.map((athlete) => Number(athlete.Ath_no))
  const selected = selection.version === item.version ? selection.ids.filter((id) => pendingNos.includes(id)) : []
  const toggle = (id) => setSelection({ version: item.version, ids: selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id] })
  const ask = (action) => setConfirming({ action, version: item.version, athletes: action === 'approve_pending' ? pending : item.athletes.filter((athlete) => selected.includes(Number(athlete.Ath_no))) })
  const confirm = async () => {
    const { action, athletes } = confirming
    setConfirming(null)
    setSelection({ version: item.version, ids: [] })
    await onReview(item, action, action === 'approve_pending' ? [] : athletes.map((athlete) => Number(athlete.Ath_no)))
  }
  const decidedCount = item.athletes.length - pending.length
  return (
    <div className="border-b p-4 last:border-0">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex-1">
          <p className="font-bold">{item.club.name}</p>
          <p className="text-sm text-ink-muted">
            {item.athletes.length} nadadores · {new Date(item.submitted_at).toLocaleString('es-VE')}
          </p>
        </div>
        <span className="rounded-full bg-warning-bg px-2 py-1 text-xs text-warning-fg">{decidedCount ? `Quedan ${pending.length} por revisar` : 'Pendiente'}</span>
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4">
          <div className="space-y-2">
            {item.athletes.map((athlete) => {
              const decision = athleteDecision(item, athlete.Ath_no)
              const id = Number(athlete.Ath_no)
              const body = (
                <>
                  <span className="flex-1">
                    {athlete.Last_name}, {athlete.First_name}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {athlete.Ath_Sex} · {athlete.Ath_age} años
                  </span>
                </>
              )
              if (decision !== 'pending')
                return (
                  <div key={athlete.Ath_no} className="flex items-center gap-3 rounded-lg bg-surface-alt p-3 opacity-80" data-decision={decision}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${DECISION_BADGE[decision][0]}`}>{DECISION_BADGE[decision][1]}</span>
                    {body}
                  </div>
                )
              return (
                <label key={athlete.Ath_no} className="flex items-center gap-3 rounded-lg bg-surface-alt p-3">
                  <input type="checkbox" checked={selected.includes(id)} disabled={busy} onChange={() => toggle(id)} />
                  {body}
                </label>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary inline-flex items-center gap-2 text-sm" disabled={busy || !selected.length} onClick={() => ask('approve')}>
                <Check className="size-4" />
                Aprobar seleccionados
              </button>
              <button className="btn-secondary text-sm" disabled={busy} onClick={() => ask('approve_pending')}>
                Aprobar pendientes ({pending.length})
              </button>
            </div>
            <div className="ml-auto">
              <button className="btn-danger inline-flex items-center gap-2 text-sm" disabled={busy || !selected.length} onClick={() => ask('reject')}>
                <X className="size-4" />
                Rechazar seleccionados
              </button>
            </div>
          </div>
        </div>
      )}
      {confirming && confirming.version === item.version && <ConfirmDecision action={confirming.action} text={confirmText(confirming.action, confirming.athletes, item.club)} onCancel={() => setConfirming(null)} onConfirm={confirm} />}
    </div>
  )
}

function ConfirmDecision({ action, text, onCancel, onConfirm }) {
  const reject = action === 'reject'
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay/80 p-4" role="dialog" aria-modal="true" aria-labelledby="late-decision-title" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <section className="card w-full max-w-lg p-5 sm:p-6">
        <h2 id="late-decision-title" className="text-lg font-extrabold">
          {text}
        </h2>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} autoFocus>
            Cancelar
          </button>
          <button className={`${reject ? 'btn-danger' : 'btn-primary'} inline-flex items-center gap-2`} onClick={onConfirm}>
            {reject ? <X className="size-4" /> : <Check className="size-4" />}
            {reject ? 'Sí, rechazar' : 'Sí, aprobar'}
          </button>
        </div>
      </section>
    </div>
  )
}
