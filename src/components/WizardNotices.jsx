import { revealAlert } from '../utils/revealAlert'
import { DRAFT_CONFLICT_NOTICE_TEXT, DRAFT_SAVED_LOCAL_TEXT, DRAFT_SAVED_ONLINE_TEXT } from '../services/concurrency'

// Referencia estable: React la llama al montar el panel (y con null al desmontarlo). Cada
// conflicto nuevo remonta el panel (key), así que cada uno vuelve a hacer scroll y foco.
export const revealOnMount = (node) => {
  if (node) revealAlert(node)
}

// v1.18.0: aviso tras un envío rechazado (conflicto, lateDecided o staleClient).
export function ConflictPanel({ conflict, onReload }) {
  return (
    <div ref={revealOnMount} role="alert" tabIndex={-1} className="scroll-mt-4 rounded-xl bg-danger-50 p-4 text-sm text-danger-700 outline-none">
      <p className="font-bold">{conflict.text}</p>
      {conflict.reload && (
        <button type="button" className="btn-primary mt-3" onClick={onReload}>
          {conflict.reload}
        </button>
      )}
    </div>
  )
}

// v1.21.0: estado del borrador. Los normales son discretos (texto gris chico); el choque con
// otro dispositivo es un aviso ámbar, con el mismo estilo que los avisos del wizard.
export function DraftStatusNotice({ status }) {
  if (status === 'conflict') {
    return (
      <div role="alert" data-draft-status="conflict" className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">
        {DRAFT_CONFLICT_NOTICE_TEXT}
      </div>
    )
  }
  const text = { local: DRAFT_SAVED_LOCAL_TEXT, online: DRAFT_SAVED_ONLINE_TEXT }[status]
  if (!text) return null
  return (
    <p role="status" className="text-xs text-slate-500" data-draft-status={status}>
      {text}
    </p>
  )
}

// v1.19.1: en modo tardías, recuerda la inscripción regular (solo lectura). Invita a agregar
// nadadores, y eso contradice al panel de conflicto, así que con un panel activo no se muestra.
export function LateRegularNotice({ isLate, lockedCount, conflict, lateDecided }) {
  if (!isLate || !lockedCount || conflict) return null
  return (
    <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
      <strong>Ya enviaste tu inscripción regular con {lockedCount} {lockedCount === 1 ? 'nadador' : 'nadadores'}.</strong> Está abajo, solo para consultar.{!lateDecided && ' Agrega abajo a quienes quieras inscribir por la vía tardía.'}
    </div>
  )
}

// Avisos de "ya enviaste… vuelve a enviar cuando quieras". Contradicen a un panel de
// conflicto y a una tardía ya revisada (D1), así que en esos casos no se muestran.
export function AlreadySubmittedNotice({ isLate, alreadySubmitted, rosterCount, conflict, lateDecided }) {
  if (!alreadySubmitted || conflict || lateDecided) return null
  if (isLate) {
    return (
      <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
        <strong>Ya enviaste una inscripción tardía.</strong> Puedes agregar más, corregir algo, y volver a enviar cuando quieras.
      </div>
    )
  }
  return rosterCount > 0 ? (
    <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
      <strong>Tus nadadores ya están cargados abajo.</strong> Puedes agregar los que falten, corregir algo, y volver a enviar cuando quieras. ¿Necesitas agregar más después? Vuelve a abrir este mismo enlace.
    </div>
  ) : (
    <div className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">
      <strong>Ya enviaste una inscripción para este club.</strong> Si no ves tus nadadores abajo, agrégalos y vuelve a enviar.
    </div>
  )
}
