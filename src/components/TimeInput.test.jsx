import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TimeInput from './TimeInput'
import AthleteForm from './AthleteForm'
import RegistrationMethodSelector from './RegistrationMethodSelector'
import { firstErrorId } from '../utils/firstError'
import { validateAthlete } from '../utils/validation'

// v1.19.0 — Tiempos en el móvil (sin DOM: render SSR + funciones puras).
const event = { eventIndex: 3, label: '25m Libre', distance: 25 }
const render = (value, showError = false) => renderToStaticMarkup(<TimeInput event={event} value={value} showError={showError} onChange={() => {}} />)

describe('TimeInput', () => {
  it('teclado de solo dígitos SIN pattern (en la PC "1:25.30" no lo frena el navegador) y placeholder en dígitos', () => {
    const html = render('')
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain('pattern=')
    expect(html).toContain('placeholder="Ej: 12530"')
    expect(html).toContain('Sin tiempo')
    expect(html).toContain('Escribe solo números: <strong>12530</strong> = 1:25.30 · <strong>3058</strong> = 30.58. Si el nadador no tiene tiempo previo, toca <strong>Sin tiempo</strong>.')
  })

  it('mientras se escribe: el campo no se reformatea y la vista previa dice cómo se guardará', () => {
    const html = render('12530')
    expect(html).toContain('value="12530"')
    expect(html).toContain('Se guardará como <span class="font-mono">1:25.30</span>')
  })

  it('"0" → vista previa "00.00 (sin tiempo)"', () => {
    expect(render('0')).toContain('Se guardará como <span class="font-mono">00.00</span> (sin tiempo)')
  })

  it('valor ya guardado ("1:25.30") se muestra tal cual, sin vista previa', () => {
    const html = render('1:25.30')
    expect(html).toContain('value="1:25.30"')
    expect(html).not.toContain('Se guardará como')
  })

  it('sin blur ni intento no hay error aunque el valor sea inválido; con showError sí', () => {
    expect(render('1:7')).not.toContain('El formato debe ser')
    expect(render('1:7')).not.toContain('input-error')
    expect(render('1:7', true)).toContain('El formato debe ser')
    expect(render('1:7', true)).toContain('input-error')
  })

  it('158 en 25 m → aviso ámbar con la sugerencia, sin error', () => {
    const html = render('158', true)
    expect(html).toContain('Si quisiste decir 1:58.00, escribe 15800.')
    expect(html).not.toContain('input-error')
  })

  it('18.50 en 25 m no avisa', () => {
    expect(render('1850')).not.toContain('¿Seguro?')
  })
})

describe('el aviso no bloquea el envío', () => {
  const form = (time) => ({ lastName: 'Pérez', firstName: 'Ana', sex: 'F', birthDate: '2013-05-15', selectedEvents: [3], times: { 3: time } })
  it('validateAthlete no tiene error con 1.58 (solo aviso), ni con "12530" aún sin blur', () => {
    expect(validateAthlete(form('158'), [], '2025-12-15')).toEqual({})
    expect(validateAthlete(form('12530'), [], '2025-12-15')).toEqual({})
    expect(validateAthlete(form('0'), [], '2025-12-15')).toEqual({})
  })
  it('un tiempo inválido sí es error', () => {
    expect(validateAthlete(form('1:7'), [], '2025-12-15')).toHaveProperty('time-3')
  })
})

describe('"Inscribir nadador" nunca queda mudo', () => {
  it('el botón está habilitado aunque falten datos, y el formulario usa noValidate', () => {
    const html = renderToStaticMarkup(<AthleteForm roster={[]} referenceDate="2026-12-31" eventConfig={{ events: [] }} editing={null} onSave={() => {}} onCancelEdit={() => {}} />)
    expect(html).toContain('novalidate=""')
    expect(html).toMatch(/<button type="submit" class="btn-primary w-full">Inscribir nadador<\/button>/)
  })

  it('con noValidate el navegador ya no frena la fecha fuera de rango: la frena nuestra validación y lleva al campo', () => {
    const form = { lastName: 'Pérez', firstName: 'Ana', sex: 'F', birthDate: '1986-05-15', selectedEvents: [], times: {} }
    const errors = validateAthlete(form, [], '2026-12-31', null, [[9, 10], [11, 12]])
    expect(errors.birthDate).toBe('La edad calculada (40 años) no pertenece a las categorías del evento')
    expect(firstErrorId(errors, [])).toBe('birthDate')
  })

  it('firstErrorId lleva al primer error en el orden de la pantalla', () => {
    expect(firstErrorId({ firstName: 'x', 'time-3': 'y' }, [3])).toBe('firstName')
    expect(firstErrorId({ duplicate: 'x' }, [])).toBe('lastName')
    expect(firstErrorId({ events: 'x' }, [])).toBe('event-selection')
    expect(firstErrorId({ 'time-7': 'x', 'time-3': 'y' }, [3, 7])).toBe('time-3')
    expect(firstErrorId({}, [3])).toBeNull()
  })
})

describe('texto de la tarjeta', () => {
  it('"Registro manual" dice "Agregar nadadores"', () => {
    const html = renderToStaticMarkup(<RegistrationMethodSelector onSelect={() => {}} />)
    expect(html).toContain('Agregar nadadores')
    expect(html).not.toContain('Comenzar')
  })
})
