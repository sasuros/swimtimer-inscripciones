import { useState } from 'react'
import useToken from '../hooks/useToken'
import useRoster from '../hooks/useRoster'
import Header from '../components/Header'
import RosterPanel from '../components/RosterPanel'
import AthleteForm from '../components/AthleteForm'
import ImportPrevious from '../components/ImportPrevious'
import PreviewPlanilla from '../components/PreviewPlanilla'
import ConfirmationScreen from '../components/ConfirmationScreen'
import InvalidToken from './InvalidToken'
import { buildMMExport } from '../utils/mmSchema'
import { submitInscription } from '../services/api'
import { downloadJson } from '../utils/download'
import { DEMO_MODE } from '../config'
import BrandFooter from '../components/BrandFooter'
import EventStatusBanner from '../components/EventStatusBanner'
import ClosedEvent from './ClosedEvent'

export default function InscriptionWizard() {
  const token = new URLSearchParams(window.location.search).get('t') || ''
  const access = useToken(token)
  if (access.loading) return <div className="flex min-h-screen items-center justify-center text-brand-800">Validando invitación…</div>
  if (!access.valid) return <InvalidToken networkError={access.networkError} />
  if (['draft','closed','archived'].includes(access.event.status)) return <ClosedEvent event={access.event} />
  return <WizardContent token={token} access={access} />
}

function WizardContent({ token, access }) {
  const previousRoster = access.inscription?.roster || []
  const [roster, setRoster] = useRoster(token, previousRoster)
  const [editing, setEditing] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [screen, setScreen] = useState('form')
  const [sending, setSending] = useState(false)
  const [finalData, setFinalData] = useState(null)
  const [lateSubmission, setLateSubmission] = useState(false)
  const save = athlete => { setRoster(current => editing ? current.map(item => item.id === athlete.id ? athlete : item) : [...current, athlete]); setEditing(null); setHighlightId(athlete.id); setTimeout(() => setHighlightId(null), 2000) }
  const remove = athlete => { if (window.confirm(`¿Eliminar a ${athlete.firstName} ${athlete.lastName} del roster?`)) { setRoster(current => current.filter(item => item.id !== athlete.id)); if (editing?.id === athlete.id) setEditing(null) } }
  const importPrevious = data => { const incoming = data.roster || data._swimtimer_roster; if (Array.isArray(incoming)) setRoster(incoming); else window.alert('Este JSON no incluye el roster editable. Usa un respaldo generado por esta versión.') }
  const submit = async () => {
    setSending(true)
    try {
      const output = await buildMMExport({ event: access.event, club: access.club, token, roster })
      const result = await submitInscription({ token, athletes: output.athletes, results: output.results, meta: output.meta, roster })
      if (!result.success) throw new Error(result.error || 'No se pudo enviar')
      const downloadable = { ...output, _swimtimer_roster: roster }
      if (DEMO_MODE) downloadJson(downloadable, `inscripcion-${access.club.code}.json`)
      setLateSubmission(Boolean(result.late)); setFinalData(downloadable); localStorage.removeItem(`swimtimer-roster:${token}`); setScreen('done')
    } catch (error) { window.alert(`${error.message}. Tu roster sigue guardado en este navegador.`) } finally { setSending(false) }
  }
  if (screen === 'done') return <ConfirmationScreen data={finalData} club={access.club} whatsapp={access.whatsapp} late={lateSubmission} />
  if (screen === 'preview') return <PreviewPlanilla roster={roster} event={access.event} club={access.club} onBack={() => setScreen('form')} onConfirm={submit} sending={sending} />
  const total = roster.reduce((sum, athlete) => sum + athlete.events.length, 0)
  return <><Header event={access.event} club={access.club} /><main className="mx-auto max-w-[752px] space-y-4 p-4 pb-28"><EventStatusBanner event={access.event} /><RosterPanel roster={roster} onEdit={setEditing} onDelete={remove} highlightId={highlightId} />
    {access.already_submitted && <div className="rounded-xl bg-success-50 p-4 text-sm text-success-800"><strong>Este club ya envió una inscripción.</strong> Puedes editarla y enviar una versión actualizada; la anterior será reemplazada.</div>}
    <div className="flex justify-end"><ImportPrevious onImport={importPrevious} /></div><AthleteForm roster={roster} referenceDate={access.event.reference_date} eventConfig={access.event} editing={editing} onSave={save} onCancelEdit={() => setEditing(null)} onQuickImport={items => setRoster(current => [...current, ...items])} />
  </main><BrandFooter />{roster.length > 0 && <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 p-3 backdrop-blur"><div className="mx-auto flex max-w-[720px] items-center justify-between gap-3"><p className="hidden text-sm text-slate-600 sm:block">{roster.length} nadadores · {total} inscripciones</p><button className="btn-primary ml-auto px-6 py-3" onClick={() => setScreen('preview')}>Finalizar y enviar inscripción</button></div></div>}</>
}
