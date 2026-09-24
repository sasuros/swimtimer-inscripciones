import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, exportConsolidated, getInscriptionsForEvent, submitInscription } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'

afterEach(() => __setSupabaseClient(null))

// v1.18.0: el envío es condicional por versión (INSERT sin fila / UPDATE ... WHERE version).
// El UNIQUE(event_id, club_code, is_late) de v1.11.0 sigue frenando el segundo INSERT.
describe('envío de inscripción: escritura condicional sobre UNIQUE(event_id, club_code, is_late)', () => {
  it('dos primeros envíos simultáneos distintos: una sola fila, el otro recibe conflicto (sin pisar)', async () => {
    const { token } = await seed({ barrier: 2 })
    const results = await Promise.allSettled([submitInscription(payload(token, 3)), submitInscription(payload(token, 5))])
    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].version).toBe(1)
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({ status: 409, details: { conflict: true, currentVersion: 1 } })
  })

  it('el reenvío reemplaza la fila: datos nuevos, submitted_at nuevo y revisión reseteada', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    const firstSubmittedAt = '2026-01-01T00:00:00.000Z'
    Object.assign(db.tables.inscriptions[0], { submitted_at: firstSubmittedAt, approved_athletes: [5001], rejected_athletes: [5002] })

    await submitInscription(payload(token, 5))
    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].athletes).toHaveLength(5)
    expect(rows[0].submitted_at > firstSubmittedAt).toBe(true)
    expect(rows[0]).toMatchObject({ late_status: null, approved_athletes: [], rejected_athletes: [], is_late: false, version: 2 })
  })

  it('la inscripción normal y la tardía del mismo club conviven', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    db.tables.events[0].status = 'accepting_late'
    await submitInscription(payload(token, 2))
    await submitInscription(payload(token, 4))

    const rows = await getInscriptionsForEvent('evt-1')
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => !row.is_late).athletes).toHaveLength(3)
    expect(rows.find((row) => row.is_late)).toMatchObject({ late_status: 'pending' })
    expect(rows.find((row) => row.is_late).athletes).toHaveLength(4)
  })

  it('el consolidado no duplica nadadores ni pruebas tras un envío doble', async () => {
    const { token } = await seed({ barrier: 2 })
    await Promise.all([submitInscription(payload(token, 4)), submitInscription(payload(token, 4))])
    const consolidated = await exportConsolidated('evt-1', 'completo')
    expect(consolidated.athletes).toHaveLength(4)
    expect(consolidated.results).toHaveLength(4)
    expect(consolidated.meta.total_athletes).toBe(4)
  })

  it('primer envío = INSERT, reenvío = UPDATE condicional; nunca borra inscripciones', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3))
    await submitInscription(payload(token, 4))
    const writes = db.calls.filter((call) => call.table === 'inscriptions' && call.op !== 'select')
    expect(writes.map((call) => call.op)).toEqual(['insert', 'update'])
  })
})
