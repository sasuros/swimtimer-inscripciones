import { useRef, useState } from 'react'
import useToken from '../hooks/useToken'
import useRoster, { legacyRosterDraftKey, rosterDraftKey } from '../hooks/useRoster'
import Header from '../components/Header'
import RosterPanel from '../components/RosterPanel'
import AthleteForm from '../components/AthleteForm'
import PreviewPlanilla from '../components/PreviewPlanilla'
import ConfirmationScreen from '../components/ConfirmationScreen'
import InvalidToken from './InvalidToken'
import { buildMMExport } from '../utils/mmSchema'
import { saveDraft, submitInscription } from '../services/api'
import BrandFooter from '../components/BrandFooter'
import EventStatusBanner from '../components/EventStatusBanner'
import ClosedEvent from './ClosedEvent'
import QuickEntryMode from '../components/QuickEntryMode'
import RegistrationMethodSelector from '../components/RegistrationMethodSelector'
import PinVerification from '../components/PinVerification'
import { deriveRosterView } from '../utils/wizardRosterView'
import { lateReviewView } from '../utils/clubInscriptionView'
import { canAddToReviewedLate, hasLateDecision, lateFixedCount } from '../services/lateDecision'
import { CONFLICT_TEXT, LATE_ADD_MORE_TEXT, LATE_DECIDED_TEXT, LATE_FIXED_CHANGED_TEXT, LATE_NOTHING_NEW_TEXT, ROSTER_REPLACED_TEXT, STALE_CLIENT_TEXT } from '../services/concurrency'
import { AlreadySubmittedNotice, ConflictPanel, DraftStatusNotice, LateRegularNotice } from '../components/WizardNotices'
import useAddFeedback from '../hooks/useAddFeedback'
import { addedText, editedText, importedNotice } from '../utils/addFeedback'
import { isRegistrationOpen } from '../utils/registrationStatus'
import { DEMO_MODE } from '../config'

// v1.16.0: el PIN se guarda solo en esta pestaña (sessionStorage) y viaja en cada
// validación, en el envío y (v1.21.0) en el guardado del borrador; el servidor lo verifica
// siempre. Nunca va a localStorage ni dentro del borrador.
const pinKey = (token) => `swimtimer-pin:${token}`
const readPin = (token) => {
  try {
    return sessionStorage.getItem(pinKey(token)) || ''
  } catch {
    return ''
  }
}

export default function InscriptionWizard() {
  const token = new URLSearchParams(window.location.search).get('t') || ''
  const [pin, setPin] = useState(() => readPin(token))
  const [refresh, setRefresh] = useState(0)
  const access = useToken(token, pin, refresh)
  const acceptPin = (value) => {
    try {
      sessionStorage.setItem(pinKey(token), value)
    } catch {
      // sin sessionStorage el PIN vive solo en memoria
    }
    setPin(value)
    setRefresh((count) => count + 1)
  }
  if (access.loading) return <div className="flex min-h-screen items-center justify-center text-brand-800">Validando invitación…</div>
  if (!access.valid) return <InvalidToken networkError={access.networkError} noToken={access.noToken} />
  if (!isRegistrationOpen(access.event.status)) return <ClosedEvent event={access.event} />
  if (access.requiresPin && !access.pinVerified) return <PinVerification token={token} access={access} onVerified={acceptPin} />
  return <WizardContent token={token} pin={pin} access={access} />
}

function WizardContent({ token, pin, access }) {
  const { isLate, locked, editableInitial } = deriveRosterView(access)
  const rosterKey = rosterDraftKey(access.eventId, access.club.code, isLate)
  const legacyKey = legacyRosterDraftKey(token, isLate)
  // v1.18.0: versión de la fila del servidor al cargar (sin fila = 0). El borrador guarda
  // sobre cuál se trabajó (baseVersion) y el envío la manda como expected_version.
  const serverVersion = access.inscription?.version ?? 0
  // v1.22.0: tardía con decisiones → los ya enviados quedan fijos (solo lectura, con su estado)
  // y solo se agregan nuevos al final. Filas viejas sin decisiones por nadador: D1 (bloqueo).
  const lateBlocked = isLate && hasLateDecision(access.inscription) && !canAddToReviewedLate(access.inscription)
  const fixedCount = isLate ? lateFixedCount(access.inscription) : 0
  const fixedRows = fixedCount ? lateReviewView(access.inscription).rows : []
  const [conflict, setConflict] = useState(null)
  const fixedChanged = () => ({ text: LATE_FIXED_CHANGED_TEXT, reload: 'Cargar la versión más reciente', lateFixedChanged: true, at: Date.now() })
  // v1.21.0: el borrador también se guarda en el servidor (con PIN). El PIN viaja solo en
  // la petición; lo que queda en localStorage es { roster, baseVersion, draftRev, dirty }.
  const [roster, setRoster, draft] = useRoster(rosterKey, editableInitial, legacyKey, serverVersion, {
    remote: access.draft || null,
    save: DEMO_MODE || lateBlocked ? null : (body, options) => saveDraft({ token, pin, ...body }, options),
    // El borrador rechazado porque no respeta a los fijos: mismo aviso que el envío (una vez).
    onSaveError: (error) => {
      if (error?.lateFixedChanged) setConflict((current) => (current?.lateFixedChanged ? current : fixedChanged()))
    }
  })
  const newRows = roster.slice(fixedCount)
  const sendingRef = useRef(false)
  const validationRoster = isLate ? [...locked, ...roster] : roster
  const [editing, setEditing] = useState(null)
  // v1.21.1: confirmación visible al agregar/editar/importar (sin mover la pantalla).
  const feedback = useAddFeedback()
  const [screen, setScreen] = useState('form')
  const [sending, setSending] = useState(false)
  const [finalData, setFinalData] = useState(null)
  const [entryMethod, setEntryMethod] = useState(null)
  const save = (athlete) => {
    setRoster((current) => (editing ? current.map((item) => (item.id === athlete.id ? athlete : item)) : [...current, athlete]))
    setEditing(null)
    feedback.show({ text: editing ? editedText(athlete) : addedText(athlete, roster.length + 1, isLate) }, [athlete.id])
  }
  const importAthletes = (items, { skipped = 0 } = {}) => {
    setRoster((current) => [...current, ...items])
    feedback.show(importedNotice(items.length, skipped, isLate), items.map((item) => item.id))
  }
  const editAthlete = (athlete) => {
    feedback.dismiss()
    setEditing({ ...athlete })
    setEntryMethod('manual')
  }
  const changeMethod = () => {
    feedback.dismiss()
    setEditing(null)
    setEntryMethod(null)
  }
  const remove = (athlete) => {
    if (window.confirm(`¿Eliminar a ${athlete.firstName} ${athlete.lastName} de la lista?`)) {
      setRoster((current) => current.filter((item) => item.id !== athlete.id))
      if (editing?.id === athlete.id) setEditing(null)
    }
  }
  const reloadLatest = () => {
    localStorage.removeItem(rosterKey)
    localStorage.removeItem(legacyKey)
    window.location.reload()
  }
  const submit = async () => {
    if (sendingRef.current) return // doble click antes de que el botón se deshabilite
    sendingRef.current = true
    setSending(true)
    try {
      const output = await buildMMExport({
        event: access.event,
        club: access.club,
        token,
        roster
      })
      const result = await submitInscription({
        token,
        pin,
        athletes: output.athletes,
        results: output.results,
        meta: output.meta,
        roster,
        expected_version: draft.baseVersion
      })
      if (!result.success) throw new Error(result.error || 'No se pudo enviar')
      setFinalData({ ...output, _swimtimer_roster: roster })
      draft.stop()
      localStorage.removeItem(rosterKey)
      localStorage.removeItem(legacyKey)
      setScreen('done')
    } catch (error) {
      if (error.status === 409) {
        // No se escribió nada. Se vuelve al formulario con el aviso (y la lista intacta).
        // `at` remonta el panel en cada rechazo: vuelve a hacer scroll y foco.
        const at = Date.now()
        setConflict(error.lateFixedChanged ? fixedChanged() : error.lateNothingNew ? { text: LATE_NOTHING_NEW_TEXT, at } : error.lateDecided ? { text: LATE_DECIDED_TEXT, at } : error.staleClient ? { text: STALE_CLIENT_TEXT, reload: 'Recargar la página', keepDraft: true, at } : { text: CONFLICT_TEXT, reload: 'Cargar la versión más reciente', at })
        setScreen('form')
      } else {
        window.alert(`${error.message}. Tu lista sigue guardada en este navegador.`)
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }
  if (screen === 'done') return <ConfirmationScreen data={finalData} />
  if (screen === 'preview') return <PreviewPlanilla roster={roster} event={access.event} club={access.club} onBack={() => setScreen('form')} onConfirm={submit} sending={sending} />
  const total = roster.reduce((sum, athlete) => sum + athlete.events.length, 0)
  return (
    <>
      <Header event={access.event} club={access.club} />
      <main className="mx-auto max-w-[752px] space-y-4 p-4 pb-28">
        {access.authorizedEmail && (
          <div className="rounded-lg border border-brand-600/20 bg-brand-50 p-3 text-sm font-semibold text-brand-800">
            Inscribiendo como: {access.authorizedEmail} para {access.club.name}
          </div>
        )}
        <EventStatusBanner event={access.event} />
        {conflict && <ConflictPanel key={conflict.at} conflict={conflict} onReload={conflict.keepDraft ? () => window.location.reload() : reloadLatest} />}
        {draft.replaced && !conflict && <div className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">{ROSTER_REPLACED_TEXT}</div>}
        {lateBlocked && !conflict && <div className="rounded-xl bg-warning-50 p-4 text-sm font-bold text-warning-800">{LATE_DECIDED_TEXT}</div>}
        {fixedCount > 0 && !conflict && <div className="rounded-xl bg-warning-50 p-4 text-sm font-bold text-warning-800">{LATE_ADD_MORE_TEXT}</div>}
        <LateRegularNotice isLate={isLate} lockedCount={locked.length} conflict={conflict} lateDecided={lateBlocked} />
        {isLate && locked.length > 0 && <RosterPanel roster={locked} readOnly title="Ya inscritos (inscripción regular)" />}
        <AlreadySubmittedNotice isLate={isLate} alreadySubmitted={access.already_submitted} rosterCount={roster.length} conflict={conflict} lateDecided={lateBlocked || fixedCount > 0} />
        {lateBlocked ? (
          // D1: fila vieja sin decisiones por nadador. Solo lectura, con la lista del SERVIDOR.
          <RosterPanel roster={lateReviewView(access.inscription).rows} readOnly title="Nadadores nuevos para tardías" />
        ) : (
          <>
            {fixedCount > 0 && (
              <>
                {/* v1.22.0: los ya enviados, fijos (sin editar ni borrar) y con su estado. */}
                <RosterPanel roster={fixedRows} readOnly title="Nadadores tardíos ya enviados" />
                <h2 className="text-lg font-bold text-brand-800">Agregar más nadadores tardíos</h2>
              </>
            )}
            {(fixedCount === 0 || newRows.length > 0) && (
              <RosterPanel roster={newRows} startIndex={fixedCount} onEdit={editAthlete} onDelete={remove} highlightIds={feedback.highlightIds} title={fixedCount ? 'Nadadores nuevos por enviar' : isLate ? 'Nadadores nuevos para tardías' : undefined} />
            )}
            <DraftStatusNotice status={draft.status} />
            {!entryMethod && <RegistrationMethodSelector onSelect={setEntryMethod} />}
            {entryMethod && (
              <button type="button" className="text-sm font-bold text-brand-700 hover:underline" onClick={changeMethod}>
                ← Cambiar método
              </button>
            )}
            {entryMethod === 'manual' && <AthleteForm roster={validationRoster} referenceDate={access.event.reference_date} eventConfig={access.event} editing={editing} onSave={save} onCancelEdit={() => setEditing(null)} notice={feedback.notice} />}
            {entryMethod === 'expert' && <QuickEntryMode referenceDate={access.event.reference_date} eventConfig={access.event} club={access.club} roster={validationRoster} onImport={importAthletes} notice={feedback.notice} />}
          </>
        )}
      </main>
      <BrandFooter />
      {roster.length > fixedCount && !lateBlocked && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3">
            <p className="hidden text-sm text-slate-600 sm:block">
              {roster.length} nadadores · {total} inscripciones
            </p>
            <button className="btn-primary ml-auto px-6 py-3" onClick={() => setScreen('preview')}>
              Finalizar y enviar inscripción
            </button>
          </div>
        </div>
      )}
    </>
  )
}
