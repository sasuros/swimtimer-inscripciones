import { useState } from 'react'
import eventData from '../data/events.json'
import { calculateAge, categoryForAge } from '../utils/ageCalculator'
import { formatTimeInput, validateTime } from '../utils/timeParser'

const SAMPLE = 'Rodriguez | Maria | F | 15/05/2013 | 25m Crawl | 32.56\nLopez | Carlos | M | 22/03/2012 | 100m Crawl | 1:15.30'

export default function QuickEntryMode({ referenceDate, eventConfig, roster, onImport }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const parse = () => {
    const rows = text.split(/\r?\n/).filter(Boolean).map((line, rowIndex) => {
      const [lastName, firstName, sexRaw, dateRaw, eventLabel, rawTime] = line.split('|').map(value => value?.trim())
      const birthDate = dateRaw?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)?.slice(1).reverse().join('-')
      const sex = sexRaw?.toUpperCase(); const age = calculateAge(birthDate, referenceDate); const ranges = eventConfig?.events ? [...new Map(eventConfig.events.map(event => [`${event.age_lo}-${event.age_hi}`, [event.age_lo, event.age_hi]])).values()] : undefined; const category = categoryForAge(age, ranges); const time = formatTimeInput(rawTime || '')
      let candidate
      if (Array.isArray(eventConfig?.events)) candidate = eventConfig.events.find(event => event.active && event.sex === sex && event.age_lo === category?.min && event.age_hi === category?.max && `${event.distance}m ${event.style}`.toLowerCase() === eventLabel?.toLowerCase())
      else { const index = eventData.events.findIndex(event => `${event.distance}m ${event.style}`.toLowerCase() === eventLabel?.toLowerCase() && category && event.ages.some(([a,b]) => a === category.min && b === category.max)); if (index >= 0) candidate = { ...eventData.events[index], event_ptr: index } }
      const errors = []
      if (!lastName || !firstName) errors.push('Faltan nombre o apellido')
      if (!['F', 'M'].includes(sex)) errors.push('Sexo debe ser F o M')
      if (!birthDate || !category) errors.push('Fecha o edad inválida')
      if (!candidate) errors.push('Evento no reconocido o fuera de categoría')
      const timeError = validateTime(time); if (timeError) errors.push(timeError)
      return { rowIndex: rowIndex + 1, lastName, firstName, sex, birthDate, age, category, eventIndex: candidate?.event_ptr, label: candidate ? `${candidate.distance}m ${candidate.style}` : eventLabel, time, errors }
    })
    setParsed(rows)
  }
  const importValid = () => {
    const grouped = new Map()
    parsed.filter(row => !row.errors.length).forEach(row => { const key = `${row.lastName}|${row.firstName}|${row.birthDate}|${row.sex}`.toLowerCase(); if (!grouped.has(key)) grouped.set(key, { id: crypto.randomUUID(), lastName: row.lastName, firstName: row.firstName, sex: row.sex, birthDate: row.birthDate, age: row.age, category: row.category, events: [] }); const athlete = grouped.get(key); if (!athlete.events.some(entry => entry.eventIndex === row.eventIndex)) athlete.events.push({ eventIndex: row.eventIndex, label: row.label, time: row.time }) })
    const additions = [...grouped.values()].filter(item => !roster.some(old => `${old.firstName} ${old.lastName}`.toLowerCase() === `${item.firstName} ${item.lastName}`.toLowerCase()))
    onImport(additions); setText(''); setParsed(null)
  }
  const validCount = parsed?.filter(row => !row.errors.length).length || 0
  return <div className="rounded-xl border border-dashed p-4"><p className="mb-2 text-sm text-slate-600">Una línea por evento: Apellido | Nombre | F/M | DD/MM/AAAA | Evento | Tiempo</p><textarea className="input min-h-32 font-mono text-sm" value={text} onChange={event => { setText(event.target.value); setParsed(null) }} placeholder={SAMPLE} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={parse} disabled={!text.trim()}>Validar filas</button>{validCount > 0 && <button type="button" className="btn-primary" onClick={importValid}>Importar {validCount} filas válidas</button>}</div>{parsed && <div className="mt-3 space-y-2 text-sm">{parsed.map(row => <div key={row.rowIndex} className={`rounded-lg px-3 py-2 ${row.errors.length ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-800'}`}><strong>Fila {row.rowIndex}:</strong> {row.errors.length ? row.errors.join(' · ') : 'Lista para importar'}</div>)}</div>}</div>
}
