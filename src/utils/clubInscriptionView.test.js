import { describe, expect, it } from 'vitest'
import { mergeClubInscriptions } from './clubInscriptionView'

// Arma una inscripción con la forma real: roster[i] ↔ athletes[i], Ath_no = club*1000 + i + 1.
const inscription = (names, { eventsPerAthlete = 1, ...extra } = {}) => {
  const athletes = names.map((_, index) => ({ Ath_no: 5000 + index + 1 }))
  return {
    roster: names.map((name, index) => ({ id: `${name}-${index}`, lastName: name })),
    athletes,
    results: athletes.flatMap(athlete => Array.from({ length: eventsPerAthlete }, (_, event) => ({ Ath_no: athlete.Ath_no, Event_ptr: event + 1 }))),
    ...extra
  }
}
const late = (names, status, approved, options = {}) => inscription(names, { ...options, status, approved_athletes: approved })

describe('mergeClubInscriptions', () => {
  it('solo regular', () => {
    const view = mergeClubInscriptions(inscription(['A', 'B', 'C'], { eventsPerAthlete: 2 }), null)
    expect(view).toMatchObject({ athleteCount: 3, resultCount: 6, lateApprovedCount: 0, lateApprovedRoster: [], hasAny: true })
    expect(view.regularRoster.map(item => item.lastName)).toEqual(['A', 'B', 'C'])
  })

  it('regular + tardía aprobada completa', () => {
    const view = mergeClubInscriptions(inscription(['A', 'B']), late(['T1', 'T2'], 'approved', [5001, 5002], { eventsPerAthlete: 3 }))
    expect(view).toMatchObject({ athleteCount: 4, resultCount: 2 + 6, lateApprovedCount: 2 })
    expect(view.lateApprovedRoster.map(item => item.lastName)).toEqual(['T1', 'T2'])
  })

  it('tardía parcialmente aprobada: solo los aprobados y sus pruebas', () => {
    const view = mergeClubInscriptions(inscription(['A']), late(['T1', 'T2', 'T3'], 'partially_approved', [5002], { eventsPerAthlete: 2 }))
    expect(view).toMatchObject({ athleteCount: 2, resultCount: 1 + 2, lateApprovedCount: 1 })
    expect(view.lateApprovedRoster.map(item => item.lastName)).toEqual(['T2'])
  })

  it.each(['pending', 'rejected', null])('tardía con estado %s no suma nada', status => {
    const view = mergeClubInscriptions(inscription(['A']), late(['T1'], status, [5001]))
    expect(view).toMatchObject({ athleteCount: 1, resultCount: 1, lateApprovedCount: 0, lateApprovedRoster: [] })
  })

  it('club solo con tardía aprobada (sin regular)', () => {
    const view = mergeClubInscriptions(null, late(['T1', 'T2'], 'partially_approved', [5001]))
    expect(view).toMatchObject({ regularRoster: [], athleteCount: 1, resultCount: 1, lateApprovedCount: 1, hasAny: true })
  })

  it('club solo con tardía pendiente: no hay nada que mostrar', () => {
    expect(mergeClubInscriptions(null, late(['T1'], 'pending', []))).toMatchObject({ athleteCount: 0, hasAny: false })
  })

  it('sin inscripciones', () => {
    expect(mergeClubInscriptions(null, null)).toEqual({ regularRoster: [], lateApprovedRoster: [], lateApprovedCount: 0, athleteCount: 0, resultCount: 0, hasAny: false })
    expect(mergeClubInscriptions(undefined, undefined).hasAny).toBe(false)
  })

  it('Ath_no repetidos entre regular y tardía no se mezclan', () => {
    // Regular y tardía arrancan ambas en 5001; aprobar 5001 en la tardía no toca a la regular.
    const regular = inscription(['A', 'B'], { eventsPerAthlete: 2 })
    const view = mergeClubInscriptions(regular, late(['T1', 'T2'], 'partially_approved', [5001], { eventsPerAthlete: 1 }))
    expect(view).toMatchObject({ athleteCount: 3, resultCount: 4 + 1 })
    expect(view.regularRoster.map(item => item.lastName)).toEqual(['A', 'B'])
    expect(view.lateApprovedRoster.map(item => item.lastName)).toEqual(['T1'])
  })

  it('acepta Ath_no aprobados como texto (JSONB) y no muta las entradas', () => {
    const regular = inscription(['A'])
    const lateInscription = late(['T1'], 'approved', ['5001'])
    const snapshot = JSON.stringify([regular, lateInscription])
    expect(mergeClubInscriptions(regular, lateInscription).lateApprovedCount).toBe(1)
    expect(JSON.stringify([regular, lateInscription])).toBe(snapshot)
  })
})
