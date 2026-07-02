import { useEffect, useState } from 'react'
import { Archive, Clipboard, ExternalLink, KeyRound, Mail, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'
import CloseRegistrationModal from '../components/CloseRegistrationModal'
import ExportMenu from '../components/ExportMenu'
import LateReviewPanel from '../components/LateReviewPanel'
import LinkDistributionModal from '../components/LinkDistributionModal'
import DeleteEventModal from '../components/DeleteEventModal'
import EmailInvitationsPanel from '../components/EmailInvitationsPanel'
import { downloadJson } from '../utils/download'
import { deleteEvent, exportAll, generateEmailInvitations, generateTokens, getDashboard, getInscription, recordInvitationResults, reviewLate, revokeMagicInvitation, sendInvitationEmails, setClubParticipation, updateEventStatus, updateClubPin } from '../services/api'
import { DEMO_MODE } from '../config'

export default function AdminDashboard({ eventId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [detail, setDetail] = useState(null)
  const [distributionOpen, setDistributionOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [emailing, setEmailing] = useState(false)
  const [invitationResults, setInvitationResults] = useState([])
  const load = async () => {
    try {
      const result = await getDashboard(eventId)
      setData(result)
      setError('')
      return result
    } catch (error) {
      setError(error.message)
    }
  }
  useEffect(() => {
    load()
  }, [eventId])
  const generate = async () => {
    setGenerating(true)
    try {
      await generateTokens(eventId)
      await load()
    } catch (error) {
      setError(error.message)
    } finally {
      setGenerating(false)
    }
  }
  const registrationUrl = (id) => `${window.location.origin}/inscribir?t=${encodeURIComponent(id)}`
  const copyText = async (text, message = 'Enlace copiado') => {
    await navigator.clipboard.writeText(text)
    setToast(message)
    setTimeout(() => setToast(''), 1800)
  }
  const viewDetail = async (club) => {
    try {
      setDetail(await getInscription(eventId, club.code))
    } catch (error) {
      setError(error.message)
    }
  }
  const download = async (type) => {
    try {
      const output = await exportAll(eventId, type)
      downloadJson(output, `swimtimer-${eventId}-${type}.json`)
    } catch (error) {
      setError(error.message)
    }
  }
  const changeStatus = async (status) => {
    await updateEventStatus(eventId, status)
    setCloseOpen(false)
    await load()
  }
  const archive = async () => {
    if (window.confirm('¿Archivar este evento? Podrás seguir consultando sus datos.')) await changeStatus('archived')
  }
  const openDistribution = async () => {
    if (data.clubs.some((club) => !club.token)) {
      await generateTokens(eventId)
      await load()
    }
    setDistributionOpen(true)
  }
  const handleReview = async (clubCode, action, ids) => {
    await reviewLate(eventId, clubCode, action, ids)
    await load()
  }
  const toggleParticipation = async (club) => {
    await setClubParticipation(eventId, club.code, club.status === 'not_participating')
    await load()
  }
  const regeneratePin = async (club) => {
    if (!window.confirm(`¿Generar un PIN nuevo para ${club.name}? El código anterior dejará de funcionar.`)) return
    await updateClubPin(eventId, club.code)
    await load()
  }
  const sendInvitations = async (selectedClub) => {
    if (DEMO_MODE) {
      setError('El envío de correos requiere el modo producción con Supabase y Resend configurados.')
      return
    }
    const candidates = (selectedClub ? [selectedClub] : data.clubs).filter((club) => club.status !== 'not_participating')
    const eligible = candidates.filter((club) => club.email)
    const missing = candidates
      .filter((club) => !club.email)
      .map((club) => ({
        club: club.name,
        clubCode: club.code,
        warning: true,
        success: false,
        error: 'Sin correo configurado'
      }))
    if (!eligible.length) {
      setInvitationResults(missing)
      return
    }
    setEmailing(true)
    setError('')
    try {
      const magic = await generateEmailInvitations(
        eventId,
        eligible.map((club) => club.code)
      )
      const byCode = new Map(magic.map((item) => [Number(item.club.code), item.token]))
      const invitations = eligible.map((club) => ({
        email: club.email,
        clubName: club.name,
        clubCode: club.code,
        pin: club.pin,
        eventName: data.event.name,
        eventDate: data.event.date_start,
        venue: data.event.venue,
        deadline: data.event.deadline,
        magicLink: registrationUrl(byCode.get(Number(club.code)))
      }))
      const sent = await sendInvitationEmails(invitations)
      await recordInvitationResults(eventId, sent)
      setInvitationResults([...sent, ...missing])
      await load()
    } catch (error) {
      setError(error.message)
    } finally {
      setEmailing(false)
    }
  }
  const revokeInvitation = async (club) => {
    if (window.confirm(`¿Revocar el acceso por correo de ${club.name}?`)) {
      await revokeMagicInvitation(eventId, club.code)
      await load()
    }
  }
  const requestDelete = () => {
    if (['active', 'accepting_late'].includes(data.event.status)) {
      setError('Cierra las inscripciones antes de eliminar el evento.')
      return
    }
    setDeleteOpen(true)
  }
  const confirmDelete = async () => {
    await deleteEvent(eventId)
    window.location.href = '/admin/eventos'
  }
  if (!data) return <div className="flex min-h-screen items-center justify-center">{error || 'Cargando panel…'}</div>
  const pending = data.clubs.filter((club) => !['received', 'not_participating'].includes(club.status))
  return (
    <>
      <AdminHeader>
        <a href="/admin/eventos" className="btn-secondary hidden text-sm sm:inline-flex">
          ← Mis eventos
        </a>
      </AdminHeader>
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {toast && <div className="fixed right-4 top-20 z-50 rounded-lg bg-success-50 px-4 py-3 font-bold text-success-800">{toast}</div>}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <a href="/admin/eventos" className="text-sm font-bold text-brand-800">
              ← Volver a mis eventos
            </a>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={data.event.status} />
              <h1 className="text-2xl font-extrabold">{data.event.name}</h1>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {data.event.date_start} · {data.event.venue || 'Sede por definir'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary inline-flex items-center gap-2 text-sm" href={`/admin/eventos/${eventId}/editar`}>
              <Pencil className="size-4" />
              Editar evento
            </a>
            {data.event.status === 'active' && (
              <button className="btn-secondary text-sm" onClick={() => setCloseOpen(true)}>
                Cerrar inscripciones
              </button>
            )}
            {data.event.status === 'accepting_late' && (
              <button className="btn-secondary text-sm" onClick={() => setCloseOpen(true)}>
                Cerrar definitivamente
              </button>
            )}
            {data.event.status === 'closed' && (
              <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={archive}>
                <Archive className="size-4" />
                Archivar
              </button>
            )}
          </div>
        </div>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Clubes', data.counts.total_clubs],
            ['Recibidas', data.counts.received],
            ['Pendientes', data.counts.pending],
            ['Nadadores', data.counts.athletes]
          ].map(([label, value]) => (
            <div className="card p-4" key={label}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-800">{value}</p>
            </div>
          ))}
        </section>
        <section className="card grid gap-3 p-4 text-sm sm:grid-cols-3">
          <Timestamp label="Inscripciones abiertas desde" value={data.timestamps.opened_at} />
          <Timestamp label="Última inscripción recibida" value={data.timestamps.last_submission_at} />
          <Timestamp label="Inscripciones cerradas" value={data.timestamps.closed_at} />
        </section>
        {error && <p className="rounded-lg bg-danger-50 p-3 text-danger-700">{error}</p>}
        <EmailInvitationsPanel clubs={data.clubs} sending={emailing} results={invitationResults} onSendAll={() => sendInvitations(null)} />
        <LateReviewPanel submissions={data.late || []} onReview={handleReview} />
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="font-bold">Clubes y enlaces</h2>
              <p className="text-sm text-slate-500">
                {data.counts.total_clubs} clubes · {data.counts.received} {data.counts.received === 1 ? 'inscripción recibida' : 'inscripciones recibidas'} · {data.counts.pending} pendientes
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportMenu onExport={download} />
              <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={load}>
                <RefreshCw className="size-4" />
                Actualizar
              </button>
              <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={openDistribution}>
                <Send className="size-4" />
                Distribuir enlaces a todos
              </button>
              <button className="btn-primary inline-flex items-center gap-2 text-sm" onClick={generate} disabled={generating}>
                <RefreshCw className={`size-4 ${generating ? 'animate-spin' : ''}`} />
                Generar enlaces
              </button>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {data.clubs.map((club) => (
              <ClubLinkCard key={club.code} club={club} eventId={eventId} emailing={emailing} url={club.token ? registrationUrl(club.token) : ''} onCopy={copyText} onOpenDetail={viewDetail} onEmail={sendInvitations} onRevoke={revokeInvitation} onToggle={toggleParticipation} onRegeneratePin={regeneratePin} />
            ))}
          </div>
          <div className="hidden">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Club</th>
                  <th className="p-3">Correo</th>
                  <th className="p-3">Nadadores</th>
                  <th className="p-3">Envío</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.clubs.map((club) => (
                  <tr key={club.code} className={`border-t transition hover:bg-slate-100 ${club.status === 'not_participating' ? 'bg-slate-100 text-slate-500' : ''}`}>
                    <td className="p-3">
                      <ClubStatus status={club.status} />
                    </td>
                    <td className="p-3 font-semibold">
                      {club.name}
                      <span className="ml-2 font-mono text-xs text-slate-500">{club.abbreviation}</span>
                    </td>
                    <td className="p-3">
                      <p>{club.email || <span className="text-slate-400">Sin correo</span>}</p>
                      <EmailStatus club={club} />
                      {!club.email && (
                        <a className="text-xs font-bold text-brand-800" href={`/admin/eventos/${eventId}/editar`}>
                          Agregar
                        </a>
                      )}
                    </td>
                    <td className="p-3">{club.athlete_count || '—'}</td>
                    <td className="p-3 text-slate-500">{club.submitted_at ? new Date(club.submitted_at).toLocaleString('es-VE') : '—'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {club.status === 'not_participating' ? (
                          <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => toggleParticipation(club)}>
                            Reincorporar
                          </button>
                        ) : (
                          <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => toggleParticipation(club)}>
                            No participa
                          </button>
                        )}
                        {club.status !== 'not_participating' && club.token && (
                          <>
                            <button className="btn-secondary inline-flex items-center gap-1 px-2 py-1.5 text-xs" onClick={() => copyText(registrationUrl(club.token))}>
                              <Clipboard className="size-3" />
                              Copiar
                            </button>
                            <a className="btn-secondary inline-flex items-center gap-1 px-2 py-1.5 text-xs" href={registrationUrl(club.token)} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3" />
                              Abrir
                            </a>
                          </>
                        )}
                        {club.status !== 'not_participating' && club.email && (
                          <button className="btn-secondary inline-flex items-center gap-1 px-2 py-1.5 text-xs" disabled={emailing} onClick={() => sendInvitations(club)}>
                            <Mail className="size-3" />
                            Correo
                          </button>
                        )}
                        {club.status !== 'not_participating' && club.email && club.invitation_sent_at && (
                          <>
                            <button className="btn-secondary px-2 py-1.5 text-xs" disabled={emailing} onClick={() => sendInvitations(club)}>
                              Reenviar invitación
                            </button>
                            <button className="px-2 py-1.5 text-xs font-bold text-danger-700" onClick={() => revokeInvitation(club)}>
                              Revocar acceso
                            </button>
                          </>
                        )}
                        {club.status === 'received' && (
                          <button className="ml-2 font-semibold text-brand-800" onClick={() => viewDetail(club)}>
                            Ver detalle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mt-12 flex justify-end border-t border-danger-700/20 pt-6">
          <button className="inline-flex items-center gap-2 rounded-lg border border-danger-700 px-4 py-2.5 font-bold text-danger-700 transition hover:bg-danger-50" onClick={requestDelete}>
            <Trash2 className="size-4" />
            Eliminar evento
          </button>
        </section>
      </main>
      {detail && <Detail inscription={detail} onClose={() => setDetail(null)} />}
      {distributionOpen && <LinkDistributionModal event={data.event} eventId={eventId} clubs={data.clubs.filter((club) => club.status !== 'not_participating')} urlFor={registrationUrl} onCopy={copyText} onSendEmail={sendInvitations} emailing={emailing} onClose={() => setDistributionOpen(false)} />}
      {closeOpen && <CloseRegistrationModal event={data.event} clubs={data.clubs} urlFor={registrationUrl} onSelect={changeStatus} onClose={() => setCloseOpen(false)} />}
      {deleteOpen && <DeleteEventModal event={data.event} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} />}
    </>
  )
}

function ClubLinkCard({ club, eventId, emailing, url, onCopy, onOpenDetail, onEmail, onRevoke, onToggle, onRegeneratePin }) {
  const inactive = club.status === 'not_participating'
  if (inactive)
    return (
      <article className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-500 opacity-70">
        <div className="flex flex-wrap items-center gap-3">
          <ClubStatus status={club.status} />
          <h3 className="font-extrabold">
            {club.name} <span className="font-mono text-xs">{club.abbreviation}</span>
          </h3>
        </div>
        <button className="mt-3 text-sm font-bold text-slate-600 hover:underline" onClick={() => onToggle(club)}>
          Reincorporar
        </button>
      </article>
    )
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ClubStatus status={club.status} />
          <h3 className="font-extrabold text-brand-800">
            {club.name} <span className="font-mono text-xs text-slate-500">{club.abbreviation}</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-brand-800">PIN: {club.pin || '—'}</span>
          <button className="p-1.5 text-slate-500 hover:text-brand-700" title="Regenerar PIN" aria-label={`Regenerar PIN de ${club.name}`} onClick={() => onRegeneratePin(club)}>
            <KeyRound className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-600">
        <p>
          {club.email || (
            <>
              <span>Sin correo</span> ·{' '}
              <a className="font-bold text-brand-700 hover:underline" href={`/admin/eventos/${eventId}/editar`}>
                Agregar correo
              </a>
            </>
          )}
        </p>
        <EmailStatus club={club} />
        <p className="mt-2">
          {club.athlete_count || '—'} nadadores · {club.inscription_count || '—'} inscripciones{club.submitted_at ? ` · Envío: ${new Date(club.submitted_at).toLocaleString('es-VE')}` : ''}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {url && (
          <>
            <button className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" onClick={() => onCopy(url)}>
              <Clipboard className="size-3" />
              Copiar
            </button>
            <a className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Abrir
            </a>
          </>
        )}
        {club.email && (
          <button className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={emailing} onClick={() => onEmail(club)}>
            <Mail className="size-3" />
            {club.invitation_sent_at ? 'Reenviar' : 'Correo'}
          </button>
        )}
        {club.status === 'received' && (
          <button className="btn-secondary text-xs" onClick={() => onOpenDetail(club)}>
            Ver detalle
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-col items-start gap-2 border-t border-slate-100 pt-3 sm:flex-row">
        <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => onToggle(club)}>
          No participa
        </button>
        {club.invitation_sent_at && (
          <button className="text-xs font-bold text-danger-700 hover:underline" onClick={() => onRevoke(club)}>
            Revocar acceso
          </button>
        )}
      </div>
    </article>
  )
}

function Timestamp({ label, value }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value ? new Date(value).toLocaleString('es-VE') : '—'}</p>
    </div>
  )
}
function EmailStatus({ club }) {
  if (club.invitation_error) return <p className="mt-1 text-xs text-danger-700">📧 Error: {club.invitation_error}</p>
  if (club.invitation_sent_at) return <p className="mt-1 text-xs text-success-800">📧 Invitación enviada · {new Date(club.invitation_sent_at).toLocaleString('es-VE')}</p>
  return <p className="mt-1 text-xs text-slate-400">📧 No enviada</p>
}
function StatusBadge({ status }) {
  const labels = {
    active: 'Inscripciones abiertas',
    accepting_late: 'Aceptando tardías',
    draft: 'Borrador',
    closed: 'Cerrado',
    archived: 'Archivado'
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${status === 'active' ? 'bg-success-800 text-white' : status === 'accepting_late' ? 'bg-warning-800 text-white' : 'bg-slate-200 text-slate-700'}`}>{labels[status] || status}</span>
}
function ClubStatus({ status }) {
  const map = {
    received: ['bg-success-800 text-white', '● Recibida'],
    sent: ['bg-warning-50 text-warning-800', '● Enlace enviado'],
    missing: ['bg-danger-50 text-danger-700', '● Sin enlace'],
    not_participating: ['bg-slate-200 text-slate-700', '● No participa']
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${map[status][0]}`}>{map[status][1]}</span>
}
function Detail({ inscription, onClose }) {
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-950/70 p-4">
      <section className="card mx-auto max-w-4xl p-5 sm:p-6">
        <div className="flex justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{inscription.meta.club_name}</h2>
            <p className="text-sm text-slate-500">
              {inscription.athletes.length} nadadores · {inscription.results.length} inscripciones
            </p>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {inscription.roster?.map((athlete) => (
            <div key={athlete.id} className="rounded-lg border bg-slate-100 p-3">
              <p className="font-bold">
                {athlete.lastName}, {athlete.firstName} · {athlete.sex} · {athlete.age} años
              </p>
              <p className="mt-1 text-sm text-slate-600">{athlete.events.map((item) => `${item.label}: ${item.time}`).join(' · ')}</p>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-5" onClick={() => downloadJson(inscription, `inscripcion-${inscription.meta.club_code}.json`)}>
          Descargar JSON del club
        </button>
      </section>
    </div>
  )
}
