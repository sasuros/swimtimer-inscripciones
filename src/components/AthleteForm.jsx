import { useMemo, useState } from 'react'
import { CircleAlert, Zap } from 'lucide-react'
import { calculateAge, categoryForAge } from '../utils/ageCalculator'
import { validateAthlete } from '../utils/validation'
import useEventFilter from '../hooks/useEventFilter'
import ErrorMessage from './ErrorMessage'
import EventSelector from './EventSelector'
import TimeInput from './TimeInput'
import QuickEntryMode from './QuickEntryMode'

const emptyForm = { lastName: '', firstName: '', sex: '', birthDate: '', selectedEvents: [], times: {} }

export default function AthleteForm({ roster, referenceDate, editing, onSave, onCancelEdit, onQuickImport }) {
  const [form, setForm] = useState(() => editing ? toForm(editing) : emptyForm)
  const [attempted, setAttempted] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const [quick, setQuick] = useState(false)
  const editingKey = editing?.id || 'new'
  const [loadedKey, setLoadedKey] = useState(editingKey)
  if (loadedKey !== editingKey) { setLoadedKey(editingKey); setForm(editing ? toForm(editing) : emptyForm); setAttempted(false); setInteracted(false) }
  const age = calculateAge(form.birthDate, referenceDate)
  const category = categoryForAge(age)
  const availableEvents = useEventFilter(category)
  const errors = useMemo(() => validateAthlete(form, roster, referenceDate, editing?.id), [form, roster, referenceDate, editing])
  const errorList = [...new Set(Object.values(errors))]
  const showErrors = attempted || interacted
  const set = (key, value) => { setInteracted(true); setForm(current => ({ ...current, [key]: value })) }
  const toggleEvent = index => { setInteracted(true); setForm(current => ({ ...current, selectedEvents: current.selectedEvents.includes(index) ? current.selectedEvents.filter(item => item !== index) : [...current.selectedEvents, index] })) }
  const submit = event => {
    event.preventDefault(); setAttempted(true)
    if (errorList.length) return
    const athleteEvents = form.selectedEvents.map(index => { const eventInfo = availableEvents.find(item => item.eventIndex === index); return { eventIndex: index, label: eventInfo.label, time: form.times[index] } })
    onSave({ id: editing?.id || crypto.randomUUID(), lastName: form.lastName.trim(), firstName: form.firstName.trim(), sex: form.sex, birthDate: form.birthDate, age, category, events: athleteEvents })
    setForm(emptyForm); setAttempted(false); setInteracted(false)
  }
  const fieldClass = key => `input ${showErrors && errors[key] ? 'input-error' : ''}`
  return <form onSubmit={submit} className="card p-4 sm:p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-brand-600">{editing ? 'Editando nadador' : `Nuevo registro`}</p><h2 className="text-xl font-bold">{editing ? `${editing.firstName} ${editing.lastName}` : `Inscribir nadador #${roster.length + 1}`}</h2></div><button type="button" onClick={() => setQuick(!quick)} className={`btn-secondary inline-flex items-center gap-2 text-sm ${quick ? 'border-brand-600 text-brand-800' : ''}`}><Zap className="size-4" />Modo rápido</button></div>
    {quick && <div className="mb-6"><QuickEntryMode referenceDate={referenceDate} roster={roster} onImport={onQuickImport} /></div>}
    <section className="space-y-4"><h3 className="font-bold">1. Datos del nadador</h3><div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="lastName">Apellido *</label><input id="lastName" className={fieldClass('lastName')} value={form.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="family-name" /><ErrorMessage>{showErrors && errors.lastName}</ErrorMessage></div>
      <div><label className="label" htmlFor="firstName">Nombre *</label><input id="firstName" className={fieldClass('firstName')} value={form.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="given-name" /><ErrorMessage>{showErrors && errors.firstName}</ErrorMessage></div>
      <div><label className="label" htmlFor="sex">Sexo *</label><select id="sex" className={fieldClass('sex')} value={form.sex} onChange={e => set('sex', e.target.value)}><option value="">Selecciona</option><option value="F">Femenino</option><option value="M">Masculino</option></select><ErrorMessage>{showErrors && errors.sex}</ErrorMessage></div>
      <div><label className="label" htmlFor="birthDate">Fecha de nacimiento *</label><input id="birthDate" type="date" min="2007-01-01" max="2022-12-31" className={fieldClass('birthDate')} value={form.birthDate} onChange={e => { setInteracted(true); setForm(current => ({ ...current, birthDate: e.target.value, selectedEvents: [], times: {} })) }} /><ErrorMessage>{showErrors && errors.birthDate}</ErrorMessage></div>
    </div>
    {category && <div className={`rounded-lg p-3 text-sm font-semibold ${form.sex === 'F' ? 'bg-female-50 text-female-800' : form.sex === 'M' ? 'bg-male-50 text-male-800' : 'bg-slate-100'}`}>Categoría: {category.label} · {age} años {form.sex && `· ${form.sex === 'F' ? 'Femenino' : 'Masculino'}`}</div>}
    <ErrorMessage>{showErrors && errors.duplicate}</ErrorMessage></section>
    {category && <div className="mt-8"><EventSelector events={availableEvents} selected={form.selectedEvents} onToggle={toggleEvent} /><ErrorMessage>{showErrors && errors.events}</ErrorMessage></div>}
    {form.selectedEvents.length > 0 && <section className="mt-8 space-y-4"><h3 className="font-bold">3. Tiempos de inscripción</h3>{form.selectedEvents.map(index => <TimeInput key={index} event={availableEvents.find(item => item.eventIndex === index)} value={form.times[index]} showError={showErrors} onChange={value => { setInteracted(true); setForm(current => ({ ...current, times: { ...current.times, [index]: value } })) }} />)}</section>}
    {showErrors && errorList.length > 0 && <div className="mt-6 rounded-lg bg-danger-50 p-3 text-sm text-danger-700"><p className="flex items-center gap-2 font-bold"><CircleAlert className="size-4" />Revisa antes de continuar:</p><ul className="mt-1 list-inside list-disc">{errorList.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <div className="mt-6 flex gap-2">{editing && <button type="button" className="btn-secondary" onClick={onCancelEdit}>Cancelar</button>}<div className="group relative flex-1"><button type="submit" disabled={errorList.length > 0} className="btn-primary w-full" title={errorList.length ? `Falta: ${errorList.join(', ')}` : ''}>{editing ? 'Guardar cambios' : 'Inscribir nadador'}</button>{errorList.length > 0 && <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-full rounded-lg bg-danger-700 p-2 text-xs text-white group-hover:block">Falta: {errorList.join(' · ')}</div>}</div></div>
  </form>
}

function toForm(athlete) { return { lastName: athlete.lastName, firstName: athlete.firstName, sex: athlete.sex, birthDate: athlete.birthDate, selectedEvents: athlete.events.map(event => event.eventIndex), times: Object.fromEntries(athlete.events.map(event => [event.eventIndex, event.time])) } }
