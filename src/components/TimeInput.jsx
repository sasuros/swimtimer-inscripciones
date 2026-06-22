import ErrorMessage from './ErrorMessage'
import { validateTime } from '../utils/timeParser'

export default function TimeInput({ event, value, onChange, showError }) {
  const error = showError ? validateTime(value) : ''
  return <div><label className="label" htmlFor={`time-${event.eventIndex}`}>{event.label}</label><input id={`time-${event.eventIndex}`} className={`input ${error ? 'input-error' : value && !validateTime(value) ? 'border-success-800' : ''}`} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="00:32.56" inputMode="decimal" /><ErrorMessage>{error}</ErrorMessage></div>
}
