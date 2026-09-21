import { describe, expect, it } from 'vitest'
import { deriveRosterView } from './wizardRosterView'

const baseAccess = (overrides = {}) => ({
  event: { status: 'active' },
  inscription: null,
  normal_inscription: null,
  ...overrides
})

describe('deriveRosterView', () => {
  it('evento normal: no hay bloque bloqueado, B arranca desde la inscripción actual', () => {
    const access = baseAccess({
      event: { status: 'active' },
      inscription: { roster: [{ id: 'normal-1' }] }
    })
    expect(deriveRosterView(access)).toEqual({
      isLate: false,
      locked: [],
      editableInitial: [{ id: 'normal-1' }]
    })
  })

  it('accepting_late, primera reapertura (sin late todavía): A trae el roster normal, B arranca vacío', () => {
    const access = baseAccess({
      event: { status: 'accepting_late' },
      normal_inscription: { roster: [{ id: 'normal-1' }, { id: 'normal-2' }] },
      inscription: null
    })
    expect(deriveRosterView(access)).toEqual({
      isLate: true,
      locked: [{ id: 'normal-1' }, { id: 'normal-2' }],
      editableInitial: []
    })
  })

  it('accepting_late, segunda reapertura (ya hay late enviada): A sigue siendo el normal, B trae el late tal cual, sin mezclarlos', () => {
    const access = baseAccess({
      event: { status: 'accepting_late' },
      normal_inscription: { roster: [{ id: 'normal-1' }] },
      inscription: { roster: [{ id: 'late-1' }] }
    })
    expect(deriveRosterView(access)).toEqual({
      isLate: true,
      locked: [{ id: 'normal-1' }],
      editableInitial: [{ id: 'late-1' }]
    })
  })

  it('accepting_late, club que nunca inscribió normal: A vacío, B vacío, sin romper', () => {
    const access = baseAccess({
      event: { status: 'accepting_late' },
      normal_inscription: null,
      inscription: null
    })
    expect(deriveRosterView(access)).toEqual({
      isLate: true,
      locked: [],
      editableInitial: []
    })
  })
})
