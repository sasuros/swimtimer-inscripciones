import ErrorMessage from './ErrorMessage'
import { NO_TIME, formatWizardTime, plausibilityWarning, validateTime } from '../utils/timeParser'

// v1.19.0: teclado de solo dígitos en el móvil (inputMode numeric, SIN pattern: en la PC
// "1:25.30" tiene que seguir entrando sin que el navegador lo frene). Mientras se escribe
// no se reformatea el campo (en iOS mueve el cursor): la ayuda es la vista previa. Al
// salir del campo se formatea y recién ahí se muestra el error (showError lo decide el
// formulario: blur de este campo o intento de inscribir).
export default function TimeInput({ event, value, onChange, onBlur, showError }) {
  const id = `time-${event.eventIndex}`
  const raw = value || ''
  const saved = formatWizardTime(raw)
  const valid = raw !== '' && !validateTime(saved)
  const error = showError ? validateTime(saved) : ''
  const warning = valid ? plausibilityWarning(saved, event.distance) : ''
  return (
    <div>
      <label className="label" htmlFor={id}>{event.label}</label>
      <div className="flex gap-2">
        <input
          id={id}
          className={`input flex-1 font-mono ${error ? 'input-error' : valid && !warning ? 'border-success-800' : ''}`}
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            onChange(formatWizardTime(e.target.value))
            onBlur?.()
          }}
          placeholder="Ej: 12530"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${id}-help`}
        />
        <button
          type="button"
          className="btn-secondary shrink-0 px-3 text-sm"
          onClick={() => {
            onChange(NO_TIME)
            onBlur?.()
          }}
        >
          Sin tiempo
        </button>
      </div>
      {valid && (saved !== raw || saved === NO_TIME) && (
        <p className="mt-1 text-sm font-semibold text-brand-800" aria-live="polite">
          Se guardará como <span className="font-mono">{saved}</span>
          {saved === NO_TIME ? ' (sin tiempo)' : ''}
        </p>
      )}
      <p id={`${id}-help`} className="field-help">
        Escribe solo números: <strong>12530</strong> = 1:25.30 · <strong>3058</strong> = 30.58. Si el nadador no tiene tiempo previo, toca <strong>Sin tiempo</strong>.
      </p>
      {warning && <p className="mt-1.5 rounded-lg bg-warning-50 p-2 text-sm text-warning-800" role="status">{warning}</p>}
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  )
}
