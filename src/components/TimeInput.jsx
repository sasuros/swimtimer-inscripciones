import ErrorMessage from './ErrorMessage'
import { formatTimeInput, validateTime } from '../utils/timeParser'

export default function TimeInput({ event, value, onChange, showError }) {
  const error = showError ? validateTime(value) : ''
  return <div><label className="label" htmlFor={`time-${event.eventIndex}`}>{event.label}</label><input id={`time-${event.eventIndex}`} className={`input font-mono ${error ? 'input-error' : value && !validateTime(value) ? 'border-success-800' : ''}`} value={value || ''} onChange={event => onChange(event.target.value)} onBlur={event => onChange(formatTimeInput(event.target.value))} placeholder="Ejemplo: 1:25.30" inputMode="decimal" /><p className="field-help">Formato: MM:SS.CC — Ejemplo: 1:25.30</p><ErrorMessage>{error}</ErrorMessage></div>
}
