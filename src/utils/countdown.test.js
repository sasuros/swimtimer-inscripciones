import { describe, expect, it } from 'vitest'
import { calculateCountdown, eventStartTime } from './countdown'

describe('countdown de eventos', () => {
  it('asume las 8:00 cuando solo hay fecha', () => {
    expect(eventStartTime('2026-12-15').getHours()).toBe(8)
  })

  it('calcula días, horas, minutos y segundos', () => {
    const start = eventStartTime('2026-12-15').getTime()
    expect(calculateCountdown('2026-12-15', start - 90061000)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1, started: false })
  })

  it('marca como iniciado al llegar a cero', () => {
    const start = eventStartTime('2026-12-15').getTime()
    expect(calculateCountdown('2026-12-15', start)).toMatchObject({ total: 0, started: true })
  })
})
