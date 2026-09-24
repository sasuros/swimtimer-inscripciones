import { beforeEach, describe, expect, it } from 'vitest'
import { buildClubFileExport } from '../utils/mmSchema'
import { demoCloneEvent, demoGetClubInscriptions, demoGetInscription, demoDashboard, demoDeleteEvent, demoExportAll, demoGenerateTokens, demoListEvents, demoLogin, demoReviewLate, demoSaveEvent, demoSetClubParticipation, demoSubmitInscription, demoUpdateEventStatus, demoUpdateLandingSettings, demoValidateToken, demoGetEvent, demoVerifyAccessPin } from './demoStorage'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
  clear: () => memory.clear()
}

// v1.16.0: validar con datos y enviar exigen el PIN del club. Estos helpers lo leen
// del evento local para que los tests existentes sigan verificando lo mismo.
const pinFor = (token) => {
  const record = JSON.parse(localStorage.getItem('swimtimer-demo:tokens') || '[]').find((item) => item.id === token)
  if (!record) return undefined
  return (demoGetEvent(record.eventId || 'evt_demo_2025')?.clubs || []).find((club) => Number(club.code) === Number(record.club?.code))?.pin
}
const validateWithPin = (token) => demoValidateToken(token, { pin: pinFor(token) })
const submitWithPin = (payload) => demoSubmitInscription({ ...payload, pin: pinFor(payload.token) })

describe('storage local de la demo', () => {
  beforeEach(() => memory.clear())

  it('protege el panel con la clave demo', () => {
    expect(() => demoLogin('incorrecta')).toThrow('Contraseña incorrecta')
    expect(demoLogin('swimtimer2025').token).toMatch(/^demo-admin-/)
  })

  it('genera, valida, usa y conserva tokens e inscripciones', () => {
    const generated = demoGenerateTokens()
    expect(generated.tokens).toHaveLength(12)
    const access = validateWithPin(generated.tokens[0].id)
    expect(access.valid).toBe(true)
    expect(access.already_submitted).toBe(false)

    submitWithPin({ token: generated.tokens[0].id, meta: { club_code: 2 }, athletes: [{ Ath_no: 2001 }], results: [{ Event_ptr: 0 }], roster: [{ id: 'athlete-1' }] })

    expect(validateWithPin(generated.tokens[0].id).already_submitted).toBe(true)
    expect(demoDashboard().counts).toMatchObject({ received: 1, athletes: 1 })
  })

  it('abre y descarga desde otro dispositivo sin guardar la inscripción', () => {
    const token = demoGenerateTokens().tokens[0].id
    expect(token.length).toBeLessThan(8000)
    memory.clear()

    const access = validateWithPin(token)
    expect(access).toMatchObject({ valid: true, localMode: false, eventId: 'evt_demo_2025' })
    expect(access.event.events).toHaveLength(76)
    const result = submitWithPin({ token, athletes: [{ Ath_no: 2001 }], results: [], meta: {}, roster: [] })
    expect(result).toMatchObject({ success: true, external: true })
    expect(localStorage.getItem('swimtimer-demo:inscriptions')).toBeNull()
  })

  it('mantiene compatibilidad con tokens v1 almacenados', () => {
    const event = demoListEvents()[0]
    const club = event.clubs[0]
    localStorage.setItem('swimtimer-demo:tokens', JSON.stringify([{
      id: 'AKP-2026-token-v1', eventId: event.id, event, club,
      expires_at: '2099-01-01T00:00:00.000Z'
    }]))
    expect(validateWithPin('AKP-2026-token-v1')).toMatchObject({
      valid: true, localMode: true, eventId: event.id
    })
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

  it('conserva el estado público textual', () => {
    const event = demoListEvents()[0]
    demoUpdateLandingSettings(event.id, { drive_url: '', is_live: 'upcoming' })
    expect(demoListEvents().find(item => item.id === event.id).is_live).toBe('upcoming')
  })

  it('procesa tardías y genera los tres consolidados v2', async () => {
    const token = demoGenerateTokens().tokens[0].id
    const athlete = { Ath_no: 2001, Last_name: 'Suros', First_name: 'Ana', Ath_Sex: 'F', Birth_date: '2013-05-15', Team_no: 2, Ath_age: 12, Comp_no: 2001 }
    const result = { Event_ptr: 1, Ath_no: 2001, ActSeed_course: 'S', ActualSeed_time: '32.50', ConvSeed_course: 'S', ConvSeed_time: '32.50' }
    submitWithPin({ token, meta: { club_code: 2 }, athletes: [athlete], results: [result], roster: [{ id: 'normal' }] })
    demoUpdateEventStatus('evt_demo_2025', 'accepting_late')
    const lateResult = submitWithPin({ token, meta: { club_code: 2 }, athletes: [{ ...athlete, First_name: 'Bea' }], results: [result], roster: [{ id: 'late' }] })
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

  it('el consolidado y el JSON por club llevan nombre corto; lo guardado queda completo', async () => {
    const token = demoGenerateTokens().tokens[0].id
    const athlete = { Ath_no: 2001, Last_name: 'De la Cruz Pérez', First_name: 'María de los Ángeles', Ath_Sex: 'F', Birth_date: '2013-05-15', Team_no: 2, Ath_age: 12, Comp_no: 2001 }
    const result = { Event_ptr: 1, Ath_no: 2001, ActSeed_course: 'S', ActualSeed_time: '32.50', ConvSeed_course: 'S', ConvSeed_time: '32.50' }
    const roster = [{ id: 'r1', lastName: 'De la Cruz Pérez', firstName: 'María de los Ángeles' }]
    submitWithPin({ token, meta: { club_code: 2, sha256: 'original' }, athletes: [athlete], results: [result], roster })

    const complete = await demoExportAll('evt_demo_2025', 'completo')
    expect(complete.athletes[0]).toMatchObject({ Last_name: 'De la Cruz', First_name: 'María Á.', Pref_name: '' })

    const saved = demoGetInscription('evt_demo_2025', 2)
    expect(saved.athletes[0]).toMatchObject({ Last_name: 'De la Cruz Pérez', First_name: 'María de los Ángeles' })
    expect(saved.roster).toEqual(roster)

    const clubFile = await buildClubFileExport(saved)
    expect(clubFile.athletes[0]).toMatchObject({ Last_name: 'De la Cruz', First_name: 'María Á.' })
    expect(clubFile.roster).toEqual(roster)
    expect(clubFile.meta.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(demoGetInscription('evt_demo_2025', 2).athletes[0].Last_name).toBe('De la Cruz Pérez')
  })

  it('tardías aprobadas suman al contador del club y aparecen en su detalle', async () => {
    const [first, second] = demoGenerateTokens().tokens
    const code = first.club.code
    const athletes = n => Array.from({ length: n }, (_, i) => ({ Ath_no: code * 1000 + i + 1, Team_no: code, Last_name: `N${i}`, First_name: 'X', Ath_age: 12 }))
    const results = n => athletes(n).map(athlete => ({ Event_ptr: 1, Ath_no: athlete.Ath_no, ActualSeed_time: '32.50' }))
    const roster = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
    submitWithPin({ token: first.id, meta: { club_code: code }, athletes: athletes(3), results: results(3), roster: roster(3, 'R') })
    demoUpdateEventStatus('evt_demo_2025', 'accepting_late')
    submitWithPin({ token: first.id, meta: { club_code: code }, athletes: athletes(2), results: results(2), roster: roster(2, 'T') })
    demoReviewLate('evt_demo_2025', code, 'approve', [code * 1000 + 2])

    const club = demoDashboard('evt_demo_2025').clubs.find(item => item.code === code)
    const complete = await demoExportAll('evt_demo_2025', 'completo')
    expect(club).toMatchObject({ athlete_count: 4, inscription_count: 4, late_approved_count: 1, status: 'received' })
    expect(club.athlete_count).toBe(complete.athletes.filter(athlete => athlete.Team_no === code).length)
    const detail = demoGetClubInscriptions('evt_demo_2025', code)
    expect(detail.regular.roster.map(item => item.id)).toEqual(['R0', 'R1', 'R2'])
    expect(detail.late.status).toBe('partially_approved')
    expect(demoGetInscription('evt_demo_2025', code).athletes).toHaveLength(3)

    // Club solo-tardía: no tiene regular, pero se ve y abre sin error.
    const other = second.club.code
    submitWithPin({ token: second.id, meta: { club_code: other }, athletes: [{ Ath_no: other * 1000 + 1, Team_no: other }], results: [], roster: roster(1, 'S') })
    demoReviewLate('evt_demo_2025', other, 'approve_all')
    const lateOnly = demoDashboard('evt_demo_2025').clubs.find(item => item.code === other)
    expect(lateOnly.status).not.toBe('received')
    expect(lateOnly).toMatchObject({ athlete_count: 1, late_approved_count: 1 })
    expect(demoGetClubInscriptions('evt_demo_2025', other)).toMatchObject({ regular: null, late: { status: 'approved' } })
  })

  it('tras abrir tardías sin envío tardío aún, expone la inscripción normal por separado (no mezclada en `inscription`)', () => {
    const token = demoGenerateTokens().tokens[0].id
    submitWithPin({ token, meta: { club_code: 2 }, athletes: [{ Ath_no: 2001 }], results: [], roster: [{ id: 'atleta-normal' }] })
    demoUpdateEventStatus('evt_demo_2025', 'accepting_late')

    const access = validateWithPin(token)
    expect(access.normal_inscription?.roster).toEqual([{ id: 'atleta-normal' }])
    expect(access.already_submitted).toBe(false)
    expect(access.inscription).toBeNull()
  })

  it('excluye clubes que no participan de pendientes y consolidado', async () => {
    const token = demoGenerateTokens().tokens[0].id
    const access = validateWithPin(token)
    const athlete = { Ath_no: 2001, Last_name: 'Suros', First_name: 'Ana', Ath_Sex: 'F', Birth_date: '2013-05-15', Team_no: access.club.code, Ath_age: 12, Comp_no: 2001 }
    submitWithPin({ token, meta: { club_code: access.club.code }, athletes: [athlete], results: [], roster: [] })
    demoSetClubParticipation(access.eventId, access.club.code, false)

    const dashboard = demoDashboard(access.eventId)
    expect(dashboard.clubs.find(club => club.code === access.club.code).status).toBe('not_participating')
    expect(dashboard.counts.pending).toBe(11)
    expect((await demoExportAll(access.eventId)).athletes).toHaveLength(0)

    demoSetClubParticipation(access.eventId, access.club.code, true)
    expect(demoDashboard(access.eventId).clubs.find(club => club.code === access.club.code).status).toBe('received')
  })
})

describe('demo: PIN obligatorio igual que el servidor (v1.16.0)', () => {
  beforeEach(() => memory.clear())

  it('enlace v2 local sin PIN: requiresPin y sin roster; con PIN, completo', () => {
    const token = demoGenerateTokens().tokens[0].id
    submitWithPin({ token, meta: { club_code: 2 }, athletes: [{ Ath_no: 2001 }], results: [], roster: [{ id: 'guardado' }] })
    const basic = demoValidateToken(token)
    expect(basic).toMatchObject({ valid: true, requiresPin: true, pinVerified: false })
    expect(basic).not.toHaveProperty('inscription')
    expect(basic).not.toHaveProperty('already_submitted')
    expect(validateWithPin(token)).toMatchObject({ pinVerified: true, already_submitted: true })
  })

  it('demoVerifyAccessPin acepta v2 con el PIN del club', () => {
    const token = demoGenerateTokens().tokens[0].id
    expect(demoVerifyAccessPin(token, pinFor(token))).toEqual({ valid: true })
    expect(demoVerifyAccessPin(token, pinFor(token) === '0000' ? '1111' : '0000')).toEqual({ valid: false })
  })

  it('enviar sin PIN se rechaza', () => {
    const token = demoGenerateTokens().tokens[0].id
    expect(() => demoSubmitInscription({ token, meta: { club_code: 2 }, athletes: [], results: [], roster: [] })).toThrow('Código de acceso')
  })
})
