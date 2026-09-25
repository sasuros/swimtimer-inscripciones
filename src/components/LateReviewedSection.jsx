import { lateReviewView } from '../utils/clubInscriptionView'

const BADGE = {
  approved: ['bg-success-bg text-success-fg', 'Aprobado'],
  rejected: ['bg-danger-bg text-danger-fg', 'Rechazado'],
  pending: ['bg-warning-bg text-warning-fg', 'Pendiente']
}

// v1.18.0: "Ver inscripciones" muestra la tardía revisada completa, con el estado de cada
// nadador: un rechazado no desaparece de la vista del admin. (Imprimir/PDF sigue mostrando
// solo las aprobadas: es la lista que compite.)
export default function LateReviewedSection({ late }) {
  const { rows, decided } = lateReviewView(late)
  if (!decided) return null
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 font-bold text-warning-fg">
        Tardías revisadas
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs">{rows.length}</span>
      </h3>
      <div className="mt-3 space-y-3">
        {rows.map((athlete) => (
          <div key={athlete.id} data-decision={athlete.decision} className={`rounded-lg border p-3 ${athlete.decision === 'approved' ? 'border-warning-fg/30 bg-warning-bg' : 'bg-surface-alt'}`}>
            <p className="flex flex-wrap items-center gap-2 font-bold">
              <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[athlete.decision][0]}`}>{BADGE[athlete.decision][1]}</span>
              {athlete.lastName}, {athlete.firstName} · {athlete.sex} · {athlete.age} años
            </p>
            {athlete.events?.length > 0 && <p className="mt-1 text-sm text-ink-soft">{athlete.events.map((item) => `${item.label}: ${item.time}`).join(' · ')}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
