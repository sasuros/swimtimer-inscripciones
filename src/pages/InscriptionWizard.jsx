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
import { submitInscription } from '../services/api'
import BrandFooter from '../components/BrandFooter'
import EventStatusBanner from '../components/EventStatusBanner'
import ClosedEvent from './ClosedEvent'
import QuickEntryMode from '../components/QuickEntryMode'
import RegistrationMethodSelector from '../components/RegistrationMethodSelector'
import PinVerification from '../components/PinVerification'
import { deriveRosterView } from '../utils/wizardRosterView'
import { CONFLICT_TEXT, LATE_DECIDED_TEXT, ROSTER_REPLACED_TEXT, STALE_CLIENT_TEXT } from '../services/concurrency'

// v1.16.0: el PIN se guarda solo en esta pestaña (sessionStorage) y viaja en cada
// validación y en el envío; el servidor lo verifica siempre.
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
  if (['draft', 'closed', 'archived'].includes(access.event.status)) return <ClosedEvent event={access.event} />
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
  const [roster, setRoster, draft] = useRoster(rosterKey, editableInitial, legacyKey, serverVersion)
  // D1: una tardía que el organizador ya revisó no se puede re-enviar desde aquí.
  const lateDecided = isLate && Boolean(access.inscription) && access.inscription.status !== 'pending'
  const [conflict, setConflict] = useState(null)
  const sendingRef = useRef(false)
  const validationRoster = isLate ? [...locked, ...roster] : roster
  const [editing, setEditing] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [screen, setScreen] = useState('form')
  const [sending, setSending] = useState(false)
  const [finalData, setFinalData] = useState(null)
  const [entryMethod, setEntryMethod] = useState(null)
  const save = (athlete) => {
    setRoster((current) => (editing ? current.map((item) => (item.id === athlete.id ? athlete : item)) : [...current, athlete]))
    setEditing(null)
    setHighlightId(athlete.id)
    setTimeout(() => setHighlightId(null), 2000)
  }
  const editAthlete = (athlete) => {
    setEditing({ ...athlete })
    setEntryMethod('manual')
  }
  const changeMethod = () => {
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
      localStorage.removeItem(rosterKey)
      localStorage.removeItem(legacyKey)
      setScreen('done')
    } catch (error) {
      if (error.status === 409) {
        // No se escribió nada. Se vuelve al formulario con el aviso (y la lista intacta).
        setConflict(error.lateDecided ? { text: LATE_DECIDED_TEXT } : error.staleClient ? { text: STALE_CLIENT_TEXT, reload: 'Recargar la página', keepDraft: true } : { text: CONFLICT_TEXT, reload: 'Cargar la versión más reciente' })
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
        {conflict && (
          <div role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-700">
            <p className="font-bold">{conflict.text}</p>
            {conflict.reload && (
              <button type="button" className="btn-primary mt-3" onClick={conflict.keepDraft ? () => window.location.reload() : reloadLatest}>
                {conflict.reload}
              </button>
            )}
          </div>
        )}
        {draft.replaced && !conflict && <div className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">{ROSTER_REPLACED_TEXT}</div>}
        {lateDecided && !conflict && <div className="rounded-xl bg-warning-50 p-4 text-sm font-bold text-warning-800">{LATE_DECIDED_TEXT}</div>}
        {isLate && locked.length > 0 && (
          <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
            <strong>Ya enviaste tu inscripción regular con {locked.length} {locked.length === 1 ? 'nadador' : 'nadadores'}.</strong> Está abajo, solo para consultar. Agrega abajo a quienes quieras inscribir por la vía tardía.
          </div>
        )}
        {isLate && locked.length > 0 && <RosterPanel roster={locked} readOnly title="Ya inscritos (inscripción regular)" />}
        {isLate && access.already_submitted && (
          <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
            <strong>Ya enviaste una inscripción tardía.</strong> Puedes agregar más, corregir algo, y volver a enviar cuando quieras.
          </div>
        )}
        {!isLate && access.already_submitted && (roster.length > 0 ? (
          <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800">
            <strong>Tus nadadores ya están cargados abajo.</strong> Puedes agregar los que falten, corregir algo, y volver a enviar cuando quieras. ¿Necesitas agregar más después? Vuelve a abrir este mismo enlace.
          </div>
        ) : (
          <div className="rounded-xl bg-warning-50 p-4 text-sm text-warning-800">
            <strong>Ya enviaste una inscripción para este club.</strong> Si no ves tus nadadores abajo, agrégalos y vuelve a enviar.
          </div>
        ))}
        <RosterPanel roster={roster} onEdit={editAthlete} onDelete={remove} highlightId={highlightId} title={isLate ? 'Nadadores nuevos para tardías' : undefined} />
        {!entryMethod && <RegistrationMethodSelector onSelect={setEntryMethod} />}
        {entryMethod && (
          <button type="button" className="text-sm font-bold text-brand-700 hover:underline" onClick={changeMethod}>
            ← Cambiar método
          </button>
        )}
        {entryMethod === 'manual' && <AthleteForm roster={validationRoster} referenceDate={access.event.reference_date} eventConfig={access.event} editing={editing} onSave={save} onCancelEdit={() => setEditing(null)} />}
        {entryMethod === 'expert' && <QuickEntryMode referenceDate={access.event.reference_date} eventConfig={access.event} club={access.club} roster={validationRoster} onImport={(items) => setRoster((current) => [...current, ...items])} />}
      </main>
      <BrandFooter />
      {roster.length > 0 && !lateDecided && (
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
