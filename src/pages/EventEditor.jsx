import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, Save, Users, Waves } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'
import { addMasterClub, cloneEvent, getEvent, getMasterClubs, saveEvent } from '../services/api'
import { standardEventTemplate } from '../utils/eventTemplate'
import { DEMO_WHATSAPP } from '../config'
import { ensureClubPin, normalizeClubPin } from '../utils/clubPin'
import { referenceDateFor } from '../utils/referenceDate'

const blank = {
  id: '',
  name: '',
  date_start: '',
  date_end: '',
  venue: '',
  reference_date: '',
  deadline: '',
  notes: '',
  drive_url: '',
  is_live: 'upcoming',
  show_on_landing: true,
  organizer_whatsapp: DEMO_WHATSAPP,
  status: 'draft',
  clubs: [],
  events: []
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STATUS_LABELS = {
  draft: 'Borrador',
  active: 'Activo',
  accepting_late: 'Aceptando tardías',
  closed: 'Cerrado',
  archived: 'Archivado'
}

export default function EventEditor({ eventId, cloneId }) {
  const imported = new URLSearchParams(window.location.search).get('imported') === '1'
  const [form, setForm] = useState(null)
  // v1.18.0: el evento tal como se cargó; saveEvent solo escribe lo que el formulario cambió.
  const [loaded, setLoaded] = useState(null)
  const [eventMode, setEventMode] = useState('results')
  const [masterClubs, setMasterClubs] = useState([])
  const [filters, setFilters] = useState({ distance: '', style: '', category: '' })
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [showClubsSection, setShowClubsSection] = useState(false)
  const [showEventsSection, setShowEventsSection] = useState(false)
  const [showClubModal, setShowClubModal] = useState(false)
  const [newClub, setNewClub] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingFocusId, setPendingFocusId] = useState(null)

  useEffect(() => {
    if (!pendingFocusId) return
    const node = document.getElementById(pendingFocusId)
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (node instanceof HTMLInputElement) node.focus({ preventScroll: true })
    }
    setPendingFocusId(null)
  }, [pendingFocusId])

  useEffect(() => {
    Promise.all([getMasterClubs(), eventId ? getEvent(eventId) : cloneId ? cloneEvent(cloneId) : Promise.resolve(null)])
      .then(([clubs, source]) => {
        setMasterClubs(clubs)
        const initial = source || {
          ...blank,
          clubs: clubs.map((club) => ({ ...club })),
          events: standardEventTemplate()
        }
        setEventMode(!source ? 'results' : (source.clubs?.length || source.events?.length) ? 'inscriptions' : 'results')
        setForm({ ...initial, clubs: initial.clubs.map(ensureClubPin) })
        if (eventId) setLoaded(source)
        setNewClub((current) => ({
          ...current,
          code: String(Math.max(...clubs.map((item) => Number(item.code)), 1) + 1)
        }))
      })
      .catch((error) => setError(error.message))
  }, [eventId, cloneId])

  const visibleEvents = useMemo(
    () =>
      (form?.events || []).filter(
        (event) =>
          (!filters.distance || String(event.distance) === filters.distance) &&
          (!filters.style || event.style === filters.style) &&
          (!filters.category || `${event.age_lo}-${event.age_hi}` === filters.category)
      ),
    [form, filters]
  )

  if (!form) return <div className="flex min-h-screen items-center justify-center">{error || 'Cargando evento...'}</div>

  const resultsOnly = eventMode === 'results'
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selected = (code) => form.clubs.some((club) => Number(club.code) === Number(code))
  const toggleClub = (club) => set('clubs', selected(club.code) ? form.clubs.filter((item) => Number(item.code) !== Number(club.code)) : [...form.clubs, ensureClubPin(club)])
  const updateClub = (code, key, value) =>
    set(
      'clubs',
      form.clubs.map((club) => (Number(club.code) === Number(code) ? { ...club, [key]: value } : club))
    )
  const toggleEvents = (predicate) => set('events', form.events.map((event) => ({ ...event, active: predicate(event) })))
  const updateEvent = (eventPtr, patch) => set('events', form.events.map((event) => (event.event_ptr === eventPtr ? { ...event, ...patch } : event)))

  const addClub = async () => {
    if (!newClub.name.trim() || !newClub.code || masterClubs.some((item) => Number(item.code) === Number(newClub.code))) return setError('Escribe un nombre y un código numérico único')
    const club = ensureClubPin({
      name: newClub.name.trim(),
      code: Number(newClub.code),
      contact_name: '',
      contact_whatsapp: '',
      email: ''
    })
    try {
      await addMasterClub(club)
      setMasterClubs((current) => [...current, club])
      set('clubs', [...form.clubs, club])
      setShowClubModal(false)
      setNewClub({ name: '', code: String(Number(newClub.code) + 1) })
      setError('')
    } catch (error) {
      setError(error.message)
    }
  }

  const invalidEmails = form.clubs.filter((club) => club.email && !EMAIL_RE.test(club.email))
  const activeCount = form.events.filter((event) => event.active).length

  const issues = [
    { id: 'field-name', active: !form.name.trim(), message: 'Escribe el nombre del evento.' },
    { id: 'field-venue', active: !form.venue.trim(), message: 'Escribe la sede del evento.' },
    { id: 'field-date-start', active: !form.date_start, message: 'Elige la fecha de inicio.' },
    ...(resultsOnly
      ? []
      : [
          { id: 'section-clubs', active: !form.clubs.length, message: 'Selecciona al menos un club en la sección 3 (Clubes participantes).', expand: () => setShowClubsSection(true) },
          { id: 'section-clubs', active: invalidEmails.length > 0, message: `Corrige el correo de ${invalidEmails[0]?.name || 'un club'} en la sección 3 (Clubes participantes).`, expand: () => setShowClubsSection(true) },
          { id: 'section-events', active: !form.events.some((event) => event.active), message: 'Activa al menos una prueba en la sección 4 (Pruebas de natación).', expand: () => setShowEventsSection(true) }
        ])
  ]

  const save = async (activate) => {
    const issue = issues.find((item) => item.active)
    if (issue) {
      setError(issue.message)
      issue.expand?.()
      setPendingFocusId(issue.id)
      return
    }
    setSaving(true)
    try {
      const saved = await saveEvent(resultsOnly ? { ...form, clubs: [], events: [] } : form, activate, loaded)
      window.location.href = `/admin/eventos/${saved.id}`
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminHeader>
        <a className="btn-secondary hidden text-sm sm:inline-flex" href={eventId ? `/admin/eventos/${eventId}` : '/admin/eventos'}>
          Cancelar
        </a>
      </AdminHeader>
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-ink-strong">Configuración</p>
          <h1 className="mt-1 text-3xl font-extrabold">{eventId ? 'Editar evento' : cloneId ? 'Clonar evento' : 'Crear evento nuevo'}</h1>
          <p className="mt-1 text-ink-muted">Elige si este evento recibirá inscripciones o solo publicará resultados desde Drive.</p>
        </div>

        <ModeSelector value={eventMode} onChange={setEventMode} />

        {imported && (
          <div className="rounded-lg border border-warning-fg/30 bg-warning-bg p-4 text-warning-fg">
            <strong>Evento importado desde Meet Manager.</strong> Revisa los datos y actívalo cuando estés listo.
          </div>
        )}
        {error && <p className="rounded-lg bg-danger-bg p-3 text-danger-fg">{error}</p>}

        <Step number="1" title="Datos básicos">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre del evento *">
              <input id="field-name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="V Copa Navidad Mantarrayas 2026" />
            </Field>
            <Field label="Sede *">
              <input id="field-venue" className="input" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Piscina Municipal de Baruta" />
            </Field>
            <Field label="Fecha de inicio *">
              <input
                id="field-date-start"
                type="date"
                className="input"
                value={form.date_start}
                onChange={(e) => set('date_start', e.target.value)}
              />
            </Field>
            <Field label="Fecha de fin" help="Opcional. Solo si el evento dura más de un día.">
              <input type="date" className="input" value={form.date_end || ''} onChange={(e) => set('date_end', e.target.value)} />
            </Field>
            {!resultsOnly && (
              <Field label="Fecha de referencia" help="Se usa para calcular la edad de los nadadores el día de la competencia.">
                <p className="input flex items-center bg-surface-muted text-ink-soft">
                  {form.date_start ? `La edad se calcula al 31 de diciembre de ${referenceDateFor(form.date_start).slice(0, 4)}.` : 'Elige primero la fecha de inicio.'}
                </p>
              </Field>
            )}
            <label>
              <span className="label">Link de Google Drive</span>
              <input type="url" className="input" value={form.drive_url || ''} onChange={(e) => set('drive_url', e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
              <span className="field-help">La carpeta de Drive donde subirás los resultados de Hy-Tek durante el evento</span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border bg-surface-muted p-3">
              <input type="checkbox" className="mt-1" checked={form.show_on_landing !== false} onChange={(e) => set('show_on_landing', e.target.checked)} />
              <span>
                <strong className="text-sm text-ink-strong">Mostrar en landing pública</strong>
                <span className="field-help">Solo los eventos con link de Drive y este checkbox activado aparecen en la landing</span>
              </span>
            </label>
          </div>
        </Step>

        {!resultsOnly && (
          <CollapsibleStep number="2" title="Opciones adicionales" open={showAdvancedOptions} onToggle={() => setShowAdvancedOptions((value) => !value)}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Límite de inscripción" help="Opcional. Se muestra a los clubes como fecha tope para inscribirse.">
                <input type="date" className="input" value={form.deadline || ''} onChange={(e) => set('deadline', e.target.value)} />
              </Field>
              <Field label="WhatsApp del organizador" help="Opcional. Aparece como contacto de WhatsApp para los clubes.">
                <input className="input" value={form.organizer_whatsapp || ''} onChange={(e) => set('organizer_whatsapp', e.target.value.replace(/\D/g, ''))} placeholder="584121234567" />
              </Field>
            </div>
          </CollapsibleStep>
        )}

        {!resultsOnly && (
          <CollapsibleStep id="section-clubs" number="3" title="Clubes participantes" open={showClubsSection} onToggle={() => setShowClubsSection((value) => !value)}>
            <ClubSelector
              masterClubs={masterClubs}
              formClubs={form.clubs}
              invalidEmails={invalidEmails}
              selected={selected}
              toggleClub={toggleClub}
              updateClub={updateClub}
              set={set}
              onAddClub={() => setShowClubModal(true)}
            />
          </CollapsibleStep>
        )}

        {!resultsOnly && (
          <CollapsibleStep id="section-events" number="4" title="Pruebas de natación" open={showEventsSection} onToggle={() => setShowEventsSection((value) => !value)}>
            <EventSelector form={form} filters={filters} setFilters={setFilters} visibleEvents={visibleEvents} set={set} toggleEvents={toggleEvents} updateEvent={updateEvent} />
          </CollapsibleStep>
        )}

        <Step number={resultsOnly ? '2' : '5'} title="Resumen y confirmar">
          <div className="grid gap-4 sm:grid-cols-3">
            {!resultsOnly && <Summary icon={<Users />} label="Clubes" value={form.clubs.length} />}
            {!resultsOnly && <Summary icon={<Waves />} label="Pruebas activas" value={activeCount} />}
            <Summary icon={<Check />} label="Estado" value={STATUS_LABELS[form.status] || 'Borrador'} />
          </div>
          <div className="mt-5 rounded-xl border p-4">
            <h3 className="text-xl font-bold text-ink-strong">{form.name || 'Evento sin nombre'}</h3>
            <p className="mt-1 text-ink-muted">
              {form.date_start || 'Sin fecha'} - {form.venue || 'Sin sede'}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {form.status === 'draft' ? (
              <>
                <button className="btn-secondary inline-flex items-center gap-2" disabled={saving} onClick={() => save(false)}>
                  <Save className="size-4" />
                  Guardar como borrador
                </button>
                <button className="btn-primary inline-flex items-center gap-2" disabled={saving} onClick={() => save(true)}>
                  <Check className="size-4" />
                  Guardar y activar
                </button>
              </>
            ) : ['active', 'accepting_late'].includes(form.status) ? (
              <button className="btn-primary inline-flex items-center gap-2" disabled={saving} onClick={() => save(false)}>
                <Save className="size-4" />
                Guardar cambios
              </button>
            ) : (
              <>
                <button className="btn-primary inline-flex items-center gap-2" disabled={saving} onClick={() => save(false)}>
                  <Save className="size-4" />
                  Guardar cambios
                </button>
                <button
                  className="rounded-lg border border-danger-fg px-4 py-2.5 font-bold text-danger-fg transition hover:bg-danger-bg"
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm('Este evento está cerrado. Activarlo REABRIRÁ las inscripciones. ¿Continuar?')) save(true)
                  }}
                >
                  Reabrir inscripciones
                </button>
              </>
            )}
          </div>
        </Step>
      </main>

      {showClubModal && <NewClubModal newClub={newClub} setNewClub={setNewClub} addClub={addClub} close={() => setShowClubModal(false)} />}
    </>
  )
}

function ModeSelector({ value, onChange }) {
  return (
    <section className="card p-4 sm:p-5">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-ink-strong">Modo del evento</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ModeButton active={value === 'results'} title="Solo resultados (Drive)" onClick={() => onChange('results')}>
          Crea una tarjeta pública para publicar series, carriles y resultados desde Google Drive.
        </ModeButton>
        <ModeButton active={value === 'inscriptions'} title="Con inscripciones" onClick={() => onChange('inscriptions')}>
          Configura clubes, pruebas, tokens e inscripción de nadadores.
        </ModeButton>
      </div>
    </section>
  )
}

function ModeButton({ active, title, children, onClick }) {
  return (
    <button type="button" className={`rounded-xl border p-4 text-left transition hover:border-brand-fg ${active ? 'border-brand-fg bg-success-bg' : 'border-line bg-surface'}`} onClick={onClick}>
      <span className="block text-lg font-extrabold text-ink-strong">{title}</span>
      <span className="mt-1 block text-sm text-ink-soft">{children}</span>
    </button>
  )
}

function ClubSelector({ masterClubs, formClubs, invalidEmails, selected, toggleClub, updateClub, set, onAddClub }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-secondary text-sm" onClick={() => set('clubs', masterClubs.map(ensureClubPin))}>
          Seleccionar todos
        </button>
        <button className="btn-secondary text-sm" onClick={() => set('clubs', [])}>
          Deseleccionar todos
        </button>
        <button className="btn-primary ml-auto inline-flex items-center gap-2 text-sm" onClick={onAddClub}>
          <Plus className="size-4" />
          Agregar club nuevo
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {masterClubs.map((club) => {
          const current = formClubs.find((item) => Number(item.code) === Number(club.code))
          const invalidEmail = invalidEmails.some((item) => Number(item.code) === Number(club.code))
          return (
            <div key={club.code} className={`rounded-xl border p-3 ${selected(club.code) ? 'bg-surface-alt' : 'opacity-60'}`}>
              <label className="flex cursor-pointer items-center gap-3 font-bold">
                <input type="checkbox" checked={selected(club.code)} onChange={() => toggleClub(club)} />
                {club.name}
                {selected(club.code) && !current?.email && <span title="Sin correo - no se podrá enviar invitación" className="text-warning-fg">!</span>}
                <span className="ml-auto font-mono text-xs text-ink-muted">#{club.code}</span>
              </label>
              {selected(club.code) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input className="input text-sm" placeholder="Contacto" value={current?.contact_name || ''} onChange={(e) => updateClub(club.code, 'contact_name', e.target.value)} />
                  <input className="input text-sm" placeholder="WhatsApp" value={current?.contact_whatsapp || ''} onChange={(e) => updateClub(club.code, 'contact_whatsapp', e.target.value.replace(/\D/g, ''))} />
                  <label>
                    <input type="email" className={`input text-sm ${invalidEmail ? 'input-error' : ''}`} placeholder="entrenador@ejemplo.com" value={current?.email || ''} onChange={(e) => updateClub(club.code, 'email', e.target.value.trim())} />
                    <span className="field-help">Correo donde se enviará la invitación</span>
                    {invalidEmail && <span className="block text-xs text-danger-fg">Escribe un correo válido</span>}
                  </label>
                  <label>
                    <span className="label">PIN de acceso</span>
                    <input className="input font-mono text-lg tracking-[.35em]" inputMode="numeric" maxLength="4" value={current?.pin || ''} onChange={(e) => updateClub(club.code, 'pin', normalizeClubPin(e.target.value))} />
                    <span className="field-help">4 dígitos para verificar al entrenador</span>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function EventSelector({ form, filters, setFilters, visibleEvents, set, toggleEvents, updateEvent }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-secondary text-sm" onClick={() => toggleEvents(() => true)}>Activar todas</button>
        <button className="btn-secondary text-sm" onClick={() => toggleEvents(() => false)}>Desactivar todas</button>
        <button className="btn-secondary text-sm" onClick={() => toggleEvents((event) => event.distance === 25)}>Solo 25m</button>
        <button className="btn-secondary text-sm" onClick={() => toggleEvents((event) => [50, 100].includes(Number(event.distance)))}>Solo 50m y 100m</button>
        <button
          className="btn-primary ml-auto text-sm"
          onClick={() => {
            const next = Math.max(...form.events.map((item) => item.event_ptr), 0) + 1
            set('events', [...form.events, { event_ptr: next, distance: 25, style: 'Crawl', age_lo: 19, age_hi: 99, sex: 'F', active: true }])
          }}
        >
          Agregar prueba
        </button>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <select className="input" value={filters.distance} onChange={(e) => setFilters({ ...filters, distance: e.target.value })}>
          <option value="">Todas las distancias</option>
          {[25, 50, 100].map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="input" value={filters.style} onChange={(e) => setFilters({ ...filters, style: e.target.value })}>
          <option value="">Todos los estilos</option>
          {[...new Set(form.events.map((item) => item.style))].map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">Todas las categorías</option>
          {[...new Set(form.events.map((item) => `${item.age_lo}-${item.age_hi}`))].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-xl border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted">
            <tr>
              <th className="p-3">Activa</th>
              <th className="p-3">Distancia</th>
              <th className="p-3">Estilo</th>
              <th className="p-3">Edad</th>
              <th className="p-3">Sexo</th>
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((event) => (
              <tr key={event.event_ptr} className="border-t hover:bg-surface-alt">
                <td className="p-3"><input type="checkbox" checked={event.active} onChange={(e) => updateEvent(event.event_ptr, { active: e.target.checked })} /></td>
                <td className="p-2"><input type="number" className="input w-24" value={event.distance} onChange={(e) => updateEvent(event.event_ptr, { distance: Number(e.target.value) })} /></td>
                <td className="p-2"><input className="input" value={event.style} onChange={(e) => updateEvent(event.event_ptr, { style: e.target.value })} /></td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <input type="number" className="input w-20" value={event.age_lo} onChange={(e) => updateEvent(event.event_ptr, { age_lo: Number(e.target.value) })} />
                    -
                    <input type="number" className="input w-20" value={event.age_hi} onChange={(e) => updateEvent(event.event_ptr, { age_hi: Number(e.target.value) })} />
                  </div>
                </td>
                <td className="p-2">
                  <select className="input w-20" value={event.sex} onChange={(e) => updateEvent(event.event_ptr, { sex: e.target.value })}>
                    <option>F</option>
                    <option>M</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function NewClubModal({ newClub, setNewClub, addClub, close }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-overlay/70 p-4">
      <div className="card w-full max-w-md p-5">
        <h2 className="text-xl font-bold">Agregar club</h2>
        <div className="mt-4 space-y-3">
          <Field label="Nombre">
            <input className="input" value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} />
          </Field>
          <Field label="Código">
            <input type="number" className="input" value={newClub.code} onChange={(e) => setNewClub({ ...newClub, code: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={close}>Cancelar</button>
          <button className="btn-primary" onClick={addClub}>Agregar</button>
        </div>
      </div>
    </div>
  )
}

function Step({ number, title, children }) {
  return (
    <section className="card p-4 sm:p-6">
      <StepHeader number={number} title={title} className="mb-5" />
      {children}
    </section>
  )
}

function CollapsibleStep({ id, number, title, open, onToggle, children }) {
  return (
    <section id={id} className="card p-4 sm:p-6">
      <button type="button" className="mb-0 flex w-full items-center gap-3 text-left" onClick={onToggle} aria-expanded={open}>
        <StepHeader number={number} title={title} className="flex-1" />
        <ChevronDown className={`size-5 text-ink-strong transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-5">{children}</div>}
    </section>
  )
}

function StepHeader({ number, title, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{number}</span>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="gold-divider ml-2 flex-1" />
    </div>
  )
}

function Field({ label, help, children }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  )
}

function Summary({ icon, label, value }) {
  return (
    <div className="rounded-lg border bg-surface-muted p-4">
      <span className="text-success-fg">{icon}</span>
      <p className="mt-3 text-sm text-ink-muted">{label}</p>
      <p className="text-2xl font-extrabold text-ink-strong">{value}</p>
    </div>
  )
}
