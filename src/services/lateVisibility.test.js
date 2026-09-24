import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, exportConsolidated, getClubInscriptions, getDashboard, getInscription, reviewLate, submitInscription } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'

// v1.18.0: el admin decide sobre la tardía tal como la mostró el tablero (IDs + versión).
const seenLate = async (clubCode = 5) => (await getDashboard('evt-1')).late.find((item) => Number(item.club.code) === clubCode)

afterEach(() => __setSupabaseClient(null))

describe('tardías aprobadas visibles por club (Supabase)', () => {
  it('regular 3 + tardía 2 con 1 aprobada: contador = consolidado; getInscription sigue solo-regular', async () => {
    const { db, token } = await seed()
    await submitInscription(payload(token, 3, 'R'))
    db.tables.events[0].status = 'accepting_late'
    await submitInscription(payload(token, 2, 'T'))

    let club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club).toMatchObject({ athlete_count: 3, inscription_count: 3, late_approved_count: 0, status: 'received' })

    await reviewLate('evt-1', 5, 'approve', [5002], await seenLate())
    const dashboard = await getDashboard('evt-1')
    club = dashboard.clubs.find((item) => item.code === 5)
    const consolidated = await exportConsolidated('evt-1', 'completo')
    expect(club).toMatchObject({ athlete_count: 4, inscription_count: 4, late_approved_count: 1, status: 'received' })
    expect(club.athlete_count).toBe(consolidated.athletes.filter((athlete) => athlete.Team_no === 5).length)
    expect(club.inscription_count).toBe(consolidated.results.length)
    expect(dashboard.counts.athletes).toBe(4)

    const { regular, late } = await getClubInscriptions('evt-1', 5)
    expect(regular.roster.map((item) => item.id)).toEqual(['R0', 'R1', 'R2'])
    expect(late).toMatchObject({ status: 'partially_approved', approved_athletes: [5002] })
    expect((await getInscription('evt-1', 5)).athletes).toHaveLength(3)
  })

  it('club solo con tardía aprobada: botón visible (late_approved_count) y detalle sin error', async () => {
    const { db, token } = await seed()
    db.tables.events[0].status = 'accepting_late'
    await submitInscription(payload(token, 2, 'T'))
    await reviewLate('evt-1', 5, 'approve_all', [], await seenLate())

    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club.status).not.toBe('received')
    expect(club).toMatchObject({ athlete_count: 2, late_approved_count: 2 })
    await expect(getClubInscriptions('evt-1', 5)).resolves.toMatchObject({ regular: null, late: { status: 'approved' } })
    await expect(getInscription('evt-1', 5)).rejects.toThrow('Inscripción no encontrada')
  })
})
