import { describe, expect, it } from 'vitest'
import { NO_TIME, SECONDS_PER_25M_CEILING, SECONDS_PER_25M_FLOOR, WIZARD_FORMAT_ERROR, formatTimeInput, formatWizardTime, plausibilityWarning, timeToSeconds, validateTime, validateWizardTime } from './timeParser'
import { parseQuickEntry } from './quickEntry'

// v1.19.0 — Tiempos en el móvil.

describe('formatWizardTime: tabla de casos', () => {
  it.each([
    // solo dígitos (teclado numérico del iPhone)
    ['12530', '1:25.30'],
    ['3058', '30.58'],
    ['158', '1.58'],
    ['58', '0.58'],
    ['5', '0.05'],
    ['100', '1.00'],
    ['0', NO_TIME],
    ['00', NO_TIME],
    ['000', NO_TIME],
    ['0000', '00.00'],
    ['00000', '0:00.00'], // NT de hoy con 5 ceros: no se normaliza
    ['123456', '12:34.56'],
    [' 12530 ', '1:25.30'],
    // con separadores (PC): exactamente como hoy
    ['1:25.30', '1:25.30'],
    ['25.30', '25.30'],
    ['1.58', '1.58'],
    ['01:25.30', '01:25.30'],
    ['0:00.00', '0:00.00'],
    ['75.30', '75.30'],
    // inválidos: siguen inválidos, sin tocar
    ['1234567', '1234567'],
    ['1:75.30', '1:75.30'],
    ['17530', '1:75.30'],
    ['1:5.3', '1:5.3'],
    ['25,30', '25,30'],
    ['abc', 'abc'],
    ['', '']
  ])('%j → %j', (input, expected) => {
    expect(formatWizardTime(input)).toBe(expected)
  })

  it('las entradas de 1 a 3 dígitos quedan válidas; 7+ dígitos, basura y segundos > 59 con ":" no', () => {
    for (const input of ['5', '58', '158', '0', '000']) expect(validateTime(formatWizardTime(input))).toBe('')
    for (const input of ['1234567', '17530', 'abc', '25,30', '1:5.3']) expect(validateTime(formatWizardTime(input))).not.toBe('')
  })
})

describe('invariante §4: el string guardado no cambia para nada que hoy se acepte', () => {
  const battery = [
    '1:25.30', '01:25.30', '12:34.56', '59:59.99', '25.30', '9.99', '0.58', '1.58', '75.30', '99.99',
    '0:00.00', '00.00', '0.00', '00:00.00', ' 1:25.30 ', '3058', '7530', '0000', '12530', '00000', '123456',
    '1:75.30', '17530', '1:5.3', '1:25.3', '32.5', '1: 25.30', '25,30', '100:00.00', '1234567', 'abc', 'NT', ''
  ]
  it.each(battery)('%j: idéntico a formatTimeInput (el parser de hoy)', (input) => {
    expect(formatWizardTime(input)).toBe(formatTimeInput(input))
  })

  it('solo cambian las entradas de 1 a 3 dígitos, que hoy son inválidas', () => {
    for (let n = 0; n <= 999; n += 1) {
      for (const input of [String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')]) {
        if (input.length > 3) continue
        expect(validateTime(formatTimeInput(input))).not.toBe('') // hoy: inválido
        expect(validateTime(formatWizardTime(input))).toBe('') // ahora: válido
      }
    }
  })

  it('"0" y "Sin tiempo" guardan "00.00", el NT probado de punta a punta', () => {
    expect(NO_TIME).toBe('00.00')
    expect(formatWizardTime('0')).toBe('00.00')
  })
})

describe('el modo experto (CSV) no cambia', () => {
  const events = [{ event_ptr: 1, distance: 25, style: 'Crawl', age_lo: 12, age_hi: 13, sex: 'F', active: true }]
  const row = (time) => parseQuickEntry(`Rodriguez;Maria;F;15/05/2013;25m Crawl;${time}`, { referenceDate: '2025-12-15', events })[0]
  it.each([
    ['0', '0', true],
    ['158', '158', true],
    ['5', '5', true],
    ['3058', '30.58', false],
    ['12530', '1:25.30', false],
    ['1:25.30', '1:25.30', false],
    ['1.58', '1.58', false],
    ['0:00.00', '0:00.00', false]
  ])('tiempo %j → %j (con error: %s), igual que antes de v1.19.0', (input, time, hasError) => {
    const parsed = row(input)
    expect(parsed.time).toBe(time)
    expect(parsed.errors.some((error) => /formato|tiempo/i.test(error))).toBe(hasError)
  })
})

describe('advertencia de plausibilidad (avisa, no bloquea)', () => {
  it('piso: 10 s por cada 25 m', () => {
    expect(SECONDS_PER_25M_FLOOR).toBe(10)
    expect(plausibilityWarning('9.99', 25)).not.toBe('')
    expect(plausibilityWarning('10.00', 25)).toBe('')
    expect(plausibilityWarning('19.99', 50)).not.toBe('')
    expect(plausibilityWarning('20.00', 50)).toBe('')
    expect(plausibilityWarning('39.99', 100)).not.toBe('')
    expect(plausibilityWarning('40.00', 100)).toBe('')
  })

  it('1.58 en 25 m avisa y sugiere la lectura probable (misma entrada + "00")', () => {
    expect(plausibilityWarning('1.58', 25)).toBe('¿Seguro? 1.58 s es muy rápido para 25 m. Si quisiste decir 1:58.00, escribe 15800.')
    expect(plausibilityWarning(formatWizardTime('158'), 25)).toContain('escribe 15800')
    expect(plausibilityWarning('0.58', 25)).toBe('¿Seguro? 0.58 s es muy rápido para 25 m. Si quisiste decir 58.00, escribe 5800.')
  })

  it('sin sugerencia cuando la lectura con "00" también sería implausible', () => {
    expect(plausibilityWarning('0.05', 25)).toBe('¿Seguro? 0.05 s es muy rápido para 25 m. Revisa el tiempo.') // 500 → 5.00
    expect(plausibilityWarning('5.00', 25)).toBe('¿Seguro? 5.00 s es muy rápido para 25 m. Si quisiste decir 5:00.00, escribe 50000.') // "500" + "00": sin techo, es plausible
    expect(plausibilityWarning('9.99', 25)).toBe('¿Seguro? 9.99 s es muy rápido para 25 m. Revisa el tiempo.') // "99900" → 9:99.00 es inválido
  })

  it('no avisa con 18.50 en 25 m, con el NT ni con tiempos inválidos', () => {
    expect(plausibilityWarning('18.50', 25)).toBe('')
    for (const nt of ['00.00', '0:00.00', '0.00', '00:00.00']) expect(plausibilityWarning(nt, 25)).toBe('')
    expect(plausibilityWarning('abc', 25)).toBe('')
    expect(plausibilityWarning('1.58', undefined)).toBe('')
  })

  it('timeToSeconds lee M:SS.CC y SS.CC', () => {
    expect(timeToSeconds('1:25.30')).toBeCloseTo(85.3)
    expect(timeToSeconds('30.58')).toBeCloseTo(30.58)
    expect(timeToSeconds('00.00')).toBe(0)
    expect(timeToSeconds('abc')).toBeNull()
  })
})

describe('v1.19.0 ajustes — mensaje de formato del wizard (el CSV no cambia)', () => {
  it('texto exacto', () => {
    expect(WIZARD_FORMAT_ERROR).toBe('Ese tiempo no se entiende. Escribe solo números: 12530 = 1:25.30 · 3058 = 30.58.')
  })

  it.each(['1:7', 'abc', '32.5', '1:25.3', '1.2.3', '12:3456.00'])('"%s" → mensaje del wizard', (value) => {
    expect(validateWizardTime(value)).toBe(WIZARD_FORMAT_ERROR)
  })

  it('vacío y segundos ≥ 60 conservan su mensaje; lo válido no tiene error', () => {
    expect(validateWizardTime('')).toBe('Escribe el tiempo de inscripción')
    expect(validateWizardTime('1:65.30')).toBe('Los segundos deben estar entre 00 y 59')
    expect(validateWizardTime('1:25.30')).toBe('')
    expect(validateWizardTime(NO_TIME)).toBe('')
  })

  it('validateTime (CSV del modo experto) sigue con sus textos', () => {
    expect(validateTime('1:7')).toBe('El formato debe ser MM:SS.CC o SS.CC — ejemplo: 1:25.30')
    expect(validateTime('32.5')).toContain('centésimas')
    const [row] = parseQuickEntry('Perez,Ana,F,10/03/2014,50m Libre,1:7', { referenceDate: '2026-12-31', events: [{ event_ptr: 1, distance: 50, style: 'Libre', age_lo: 11, age_hi: 12, sex: 'F' }] })
    // v1.20.0: el CSV tolerante tiene su propio texto (validateTime no cambia).
    expect(row.errors.join(' ')).toContain('El tiempo "1:7" no se entiende. Escríbelo como 25.30 o 1:25.30, o NT si no tiene.')
    expect(row.errors.join(' ')).not.toContain('Ese tiempo no se entiende')
  })
})

describe('v1.19.0 ajustes — techo de plausibilidad (aviso, no bloquea)', () => {
  it('constante única: 3:00 por cada 25 m', () => {
    expect(SECONDS_PER_25M_CEILING).toBe(180)
  })

  it('caso real: 58:08.44 en 25 m → texto exacto', () => {
    expect(plausibilityWarning('58:08.44', 25)).toBe('¿Seguro? 58:08.44 es muy lento para 25 m. Revisa el tiempo.')
  })

  it.each([
    ['3:00.00', 25, false],
    ['3:00.01', 25, true],
    ['6:00.00', 50, false],
    ['6:00.01', 50, true],
    ['12:00.00', 100, false],
    ['12:00.01', 100, true],
    ['24:00.00', 200, false],
    ['24:00.01', 200, true]
  ])('%s en %i m → avisa: %s', (value, meters, warns) => {
    const text = plausibilityWarning(value, meters)
    expect(text.includes('muy lento')).toBe(warns)
    if (warns) expect(text).toBe(`¿Seguro? ${value} es muy lento para ${meters} m. Revisa el tiempo.`)
  })

  it('el NT no lo dispara; un tiempo normal tampoco; el piso sigue igual', () => {
    expect(plausibilityWarning(NO_TIME, 25)).toBe('')
    expect(plausibilityWarning('32.50', 50)).toBe('')
    expect(plausibilityWarning('1:25.30', 100)).toBe('')
    expect(plausibilityWarning('5.00', 50)).toContain('muy rápido')
  })

  it('es aviso: el tiempo sigue siendo válido (no bloquea)', () => {
    expect(validateWizardTime('58:08.44')).toBe('')
  })
})
