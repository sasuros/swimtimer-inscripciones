import { beforeEach, describe, expect, it } from 'vitest'
import { demoCloneEvent, demoDashboard, demoDeleteEvent, demoExportAll, demoGenerateTokens, demoListEvents, demoLogin, demoReviewLate, demoSaveEvent, demoSubmitInscription, demoUpdateEventStatus, demoValidateToken } from './demoStorage'

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

  it('elimina un evento cerrado y todos sus datos asociados', () => {
    const source = demoListEvents()[0]
    const draft = demoSaveEvent({ ...demoCloneEvent(source.id), name: 'Evento eliminable', date_start: '2027-05-10', reference_date: '2027-05-10', venue: 'Piscina' }, false)
    demoGenerateTokens(draft.id)
    localStorage.setItem('swimtimer-demo:inscriptions', JSON.stringify({ [`${draft.id}:2`]: { eventId: draft.id } }))
    localStorage.setItem('swimtimer-demo:inscriptions:late', JSON.stringify({ [`${draft.id}:2`]: { eventId: draft.id } }))

    expect(demoDeleteEvent(draft.id)).toEqual({ success: true })
    expect(demoListEvents().some(event => event.id === draft.id)).toBe(false)
    expect(JSON.parse(localStorage.getItem('swimtimer-demo:tokens'))).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('swimtimer-demo:inscriptions'))).toEqual({})
    expect(JSON.parse(localStorage.getItem('swimtimer-demo:inscriptions:late'))).toEqual({})
    expect(localStorage.getItem(`swimtimer-demo:event:${draft.id}`)).toBeNull()
  })

  it('no elimina eventos con inscripciones abiertas', () => {
    const event = demoListEvents()[0]
    expect(() => demoDeleteEvent(event.id)).toThrow('Cierra las inscripciones antes de eliminar el evento.')
  })

  it('procesa tardías y genera los tres consolidados v2', async () => {
    const token = demoGenerateTokens().tokens[0].id
    const athlete = { Ath_no: 2001, Last_name: 'Suros', First_name: 'Ana', Ath_Sex: 'F', Birth_date: '2013-05-15', Team_no: 2, Ath_age: 12, Comp_no: 2001 }
    const result = { Event_ptr: 1, Ath_no: 2001, ActSeed_course: 'S', ActualSeed_time: '32.50', ConvSeed_course: 'S', ConvSeed_time: '32.50' }
    demoSubmitInscription({ token, meta: { club_code: 2 }, athletes: [athlete], results: [result], roster: [{ id: 'normal' }] })
    demoUpdateEventStatus('evt_demo_2025', 'accepting_late')
    const lateResult = demoSubmitInscription({ token, meta: { club_code: 2 }, athletes: [{ ...athlete, First_name: 'Bea' }], results: [result], roster: [{ id: 'late' }] })
    expect(lateResult.late).toBe(true)
    expect(demoDashboard().counts.late_pending).toBe(1)
    demoReviewLate('evt_demo_2025', 2, 'approve_all')
    const principal = await demoExportAll('evt_demo_2025', 'principal')
    const complete = await demoExportAll('evt_demo_2025', 'completo')
    const supplement = await demoExportAll('evt_demo_2025', 'supplement')
    expect(principal.meta.type).toBe('principal')
    expect(principal.athletes).toHaveLength(1)
    expect(complete.athletes.map(item => item.Ath_no)).toEqual([2001, 2002])
    expect(supplement.athletes[0].late).toBe(true)
    expect(Object.keys(complete.results[0])).toHaveLength(87)
    expect(complete.meta.sha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
