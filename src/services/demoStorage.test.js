import { beforeEach, describe, expect, it } from 'vitest'
import { demoCloneEvent, demoDashboard, demoGenerateTokens, demoListEvents, demoLogin, demoSaveEvent, demoSubmitInscription, demoValidateToken } from './demoStorage'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
  clear: () => memory.clear()
}

describe('storage local de la demo', () => {
  beforeEach(() => memory.clear())

  it('protege el panel con la clave demo', () => {
    expect(() => demoLogin('incorrecta')).toThrow('Contraseña incorrecta')
    expect(demoLogin('swimtimer2025').token).toMatch(/^demo-admin-/)
  })

  it('genera, valida, usa y conserva tokens e inscripciones', () => {
    const generated = demoGenerateTokens()
    expect(generated.tokens).toHaveLength(12)
    const access = demoValidateToken(generated.tokens[0].id)
    expect(access.valid).toBe(true)
    expect(access.already_submitted).toBe(false)

    demoSubmitInscription({ token: generated.tokens[0].id, meta: { club_code: 2 }, athletes: [{ Ath_no: 2001 }], results: [{ Event_ptr: 0 }], roster: [{ id: 'athlete-1' }] })

    expect(demoValidateToken(generated.tokens[0].id).already_submitted).toBe(true)
    expect(demoDashboard().counts).toMatchObject({ received: 1, athletes: 1 })
  })

  it('crea y clona eventos sin copiar inscripciones', () => {
    const source = demoListEvents()[0]
    const draft = demoCloneEvent(source.id)
    const saved = demoSaveEvent({ ...draft, name: 'Copa 2027', date_start: '2027-05-10', reference_date: '2027-05-10', venue: 'Piscina Olímpica' }, false)
    expect(saved.id).not.toBe(source.id)
    expect(saved.status).toBe('draft')
    expect(saved.events).toHaveLength(76)
    expect(demoDashboard(saved.id).counts.received).toBe(0)
  })
})
