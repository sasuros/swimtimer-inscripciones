import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Pencil } from 'lucide-react'
import { birthDateBounds, calculateAge, categoryForAge } from '../utils/ageCalculator'
import { validateAthlete } from '../utils/validation'
import { revealEditForm } from '../utils/revealEditForm'
import { revealAlert } from '../utils/revealAlert'
import { firstErrorId } from '../utils/firstError'
import { formatWizardTime } from '../utils/timeParser'
import useEventFilter from '../hooks/useEventFilter'
import ErrorMessage from './ErrorMessage'
import EventSelector from './EventSelector'
import TimeInput from './TimeInput'

const emptyForm = { lastName: '', firstName: '', sex: '', birthDate: '', selectedEvents: [], times: {} }

export default function AthleteForm({ roster, referenceDate, eventConfig, editing, onSave, onCancelEdit }) {
  const [form, setForm] = useState(() => editing ? toForm(editing) : emptyForm)
  const [attempted, setAttempted] = useState(false)
  const [interacted, setInteracted] = useState(false)
  // v1.19.0: el error de un tiempo se muestra al salir de ESE campo (o al intentar inscribir), no mientras se escribe.
  const [blurredTimes, setBlurredTimes] = useState({})
  const formRef = useRef(null)
  // Cada ✏️ llega como objeto nuevo (InscriptionWizard.editAthlete), así también re-enfoca al tocar el mismo nadador.
  useEffect(() => { if (editing) revealEditForm(formRef.current) }, [editing])
  const editingKey = editing?.id || 'new'
  const [loadedKey, setLoadedKey] = useState(editingKey)
  if (loadedKey !== editingKey) { setLoadedKey(editingKey); setForm(editing ? toForm(editing) : emptyForm); setAttempted(false); setInteracted(false); setBlurredTimes({}) }
  const age = calculateAge(form.birthDate, referenceDate)
  const eventCategories = eventConfig?.events ? [...new Map(eventConfig.events.map(event => [`${event.age_lo}-${event.age_hi}`, [event.age_lo, event.age_hi]])).values()] : undefined
  const category = categoryForAge(age, eventCategories)
  const bounds = birthDateBounds(eventCategories, referenceDate)
  const availableEvents = useEventFilter(category, form.sex, eventConfig)
  const errors = useMemo(() => validateAthlete(form, roster, referenceDate, editing?.id, eventCategories), [form, roster, referenceDate, editing, eventConfig])
  const errorList = [...new Set(Object.values(errors))]
  const showErrors = attempted || interacted
  const showTimeError = index => attempted || Boolean(blurredTimes[index])
  const visibleErrors = [...new Set(Object.entries(errors).filter(([key]) => !key.startsWith('time-') || showTimeError(Number(key.slice(5)))).map(([, error]) => error))]
  const set = (key, value) => { setInteracted(true); setForm(current => ({ ...current, [key]: value })) }
  const toggleEvent = index => { setInteracted(true); setForm(current => ({ ...current, selectedEvents: current.selectedEvents.includes(index) ? current.selectedEvents.filter(item => item !== index) : [...current.selectedEvents, index] })) }
  const submit = event => {
    event.preventDefault(); setAttempted(true)
    // v1.19.0: el botón nunca queda mudo. Con errores, se muestran y se lleva al primero (patrón v1.8.2).
    if (errorList.length) { const id = firstErrorId(errors, form.selectedEvents); if (id) revealAlert(document.getElementById(id)); return }
    const athleteEvents = form.selectedEvents.map(index => { const eventInfo = availableEvents.find(item => item.eventIndex === index); return { eventIndex: index, label: eventInfo.label, time: formatWizardTime(form.times[index]) } })
    onSave({ id: editing?.id || crypto.randomUUID(), lastName: form.lastName.trim(), firstName: form.firstName.trim(), sex: form.sex, birthDate: form.birthDate, age, category, events: athleteEvents })
    setForm(emptyForm); setAttempted(false); setInteracted(false); setBlurredTimes({})
  }
  const fieldClass = key => `input ${showErrors && errors[key] ? 'input-error' : ''}`
  return <form ref={formRef} onSubmit={submit} noValidate className={`card scroll-mt-4 p-4 sm:p-6 ${editing ? 'ring-2 ring-brand-600' : ''}`} data-editing={editing ? 'true' : undefined}>
    {editing
      ? <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand-600/30 bg-brand-50 p-3" role="status"><Pencil className="mt-0.5 size-5 shrink-0 text-brand-700" /><div><h2 className="text-lg font-bold text-brand-800">{`Editando a ${editing.firstName} ${editing.lastName}`}</h2><p className="text-sm text-slate-600">Cambia lo que necesites y toca «Guardar cambios». «Cancelar» deja todo como estaba.</p></div></div>
      : <div className="mb-6"><p className="text-sm font-semibold text-brand-600">Nuevo registro</p><h2 className="text-xl font-bold">{`Inscribir nadador #${roster.length + 1}`}</h2></div>}
    <section className="space-y-4"><StepTitle number="1" title="Datos del nadador" /><div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="lastName">Apellido *</label><input id="lastName" className={fieldClass('lastName')} value={form.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="family-name" placeholder="Ejemplo: Pérez" /><p className="field-help">Escribe solo el primer apellido del nadador.</p><ErrorMessage>{showErrors && errors.lastName}</ErrorMessage></div>
      <div><label className="label" htmlFor="firstName">Nombre *</label><input id="firstName" className={fieldClass('firstName')} value={form.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="given-name" placeholder="Ejemplo: Ana María" /><p className="field-help">Escribe el primer nombre del nadador. Si es compuesto (como 'Ana María'), escríbelo completo.</p><ErrorMessage>{showErrors && errors.firstName}</ErrorMessage></div>
      <div><label className="label" htmlFor="sex">Sexo *</label><select id="sex" className={fieldClass('sex')} value={form.sex} onChange={e => set('sex', e.target.value)}><option value="">Elegir sexo</option><option value="F">Femenino</option><option value="M">Masculino</option></select><p className="field-help">Se usa para mostrar las pruebas disponibles</p><ErrorMessage>{showErrors && errors.sex}</ErrorMessage></div>
      <div><label className="label" htmlFor="birthDate">Fecha de nacimiento *</label><input id="birthDate" type="date" min={bounds?.min} max={bounds?.max} className={fieldClass('birthDate')} value={form.birthDate} onChange={e => { setInteracted(true); setForm(current => ({ ...current, birthDate: e.target.value, selectedEvents: [], times: {} })) }} /><p className="field-help">La edad se calcula automáticamente</p><ErrorMessage>{showErrors && errors.birthDate}</ErrorMessage></div>
    </div>
    {category && form.sex && <div className="rounded-lg border border-brand-600/20 bg-brand-50 p-4 text-center text-lg font-extrabold text-brand-600">{category.label} · {form.sex === 'F' ? 'Femenino' : 'Masculino'}<span className="mt-1 block text-xs font-semibold opacity-70">Edad calculada: {age} años</span></div>}
    <ErrorMessage>{showErrors && errors.duplicate}</ErrorMessage></section>
    {category && <div id="event-selection" tabIndex={-1} className="mt-8 scroll-mt-4 outline-none"><EventSelector events={availableEvents} selected={form.selectedEvents} onToggle={toggleEvent} /><ErrorMessage>{showErrors && errors.events}</ErrorMessage></div>}
    {form.selectedEvents.length > 0 && <section className="mt-8 space-y-4"><StepTitle number="3" title="Tiempos de inscripción" />{form.selectedEvents.map(index => <TimeInput key={index} event={availableEvents.find(item => item.eventIndex === index)} value={form.times[index]} showError={showTimeError(index)} onBlur={() => setBlurredTimes(current => ({ ...current, [index]: true }))} onChange={value => { setInteracted(true); setForm(current => ({ ...current, times: { ...current.times, [index]: value } })) }} />)}</section>}
    {showErrors && visibleErrors.length > 0 && <div className="mt-6 rounded-lg bg-danger-50 p-3 text-sm text-danger-700"><p className="flex items-center gap-2 font-bold"><CircleAlert className="size-4" />Revisa antes de continuar:</p><ul className="mt-1 list-inside list-disc">{visibleErrors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <div className="mt-6 flex gap-2">{editing && <button type="button" className="btn-secondary" onClick={onCancelEdit}>Cancelar</button>}<div className="group relative flex-1"><button type="submit" className="btn-primary w-full">{editing ? 'Guardar cambios' : 'Inscribir nadador'}</button>{errorList.length > 0 && <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-full rounded-lg bg-danger-700 p-2 text-xs text-white group-hover:block">Falta: {errorList.join(' · ')}</div>}</div></div>
  </form>
}

function toForm(athlete) { return { lastName: athlete.lastName, firstName: athlete.firstName, sex: athlete.sex, birthDate: athlete.birthDate, selectedEvents: athlete.events.map(event => event.eventIndex), times: Object.fromEntries(athlete.events.map(event => [event.eventIndex, event.time])) } }
function StepTitle({ number, title }) { return <h3 className="flex items-center gap-2 font-extrabold text-brand-800"><span className="step-number">{number}</span>{title}</h3> }
