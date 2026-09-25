import { describe, expect, it } from 'vitest'
import { clubLabel, confirmText, namesList, reviewSuccessText } from './lateReviewText'

// Caso del preview: la tarjeta muestra el nombre (CAC); la abreviatura de MM es CNCAC.
const club = { code: 11, name: 'CAC', abbreviation: 'CNCAC' }
const swimmer = (n) => ({ Ath_no: 11000 + n, First_name: 'Tardía', Last_name: String(n) })

describe('textos de la revisión de tardías', () => {
  it('club: el mismo nombre que la tarjeta (name), nunca la abreviatura si hay nombre', () => {
    expect(clubLabel(club)).toBe('CAC')
    expect(clubLabel({ name: 'Club X', short_name: 'X', abbreviation: 'CNX' })).toBe('Club X')
    expect(clubLabel({ abbreviation: 'CNX' })).toBe('CNX')
    expect(clubLabel({ code: 7 })).toBe('Club 7')
  })

  it('confirmación: nombra hasta 5, con más da el conteo', () => {
    expect(confirmText('approve', [swimmer(1)], club)).toBe('¿Aprobar a Tardía 1 (CAC)? Esta decisión no se puede cambiar después.')
    expect(confirmText('reject', [swimmer(2)], club)).toBe('¿Rechazar a Tardía 2 (CAC)? Esta decisión no se puede cambiar después.')
    expect(namesList([1, 2, 3].map(swimmer))).toBe('Tardía 1, Tardía 2 y Tardía 3')
    expect(confirmText('approve_pending', [1, 2, 3, 4, 5].map(swimmer), club)).toContain('Tardía 1, Tardía 2, Tardía 3, Tardía 4 y Tardía 5 (CAC)')
    expect(confirmText('approve_pending', [1, 2, 3, 4, 5, 6].map(swimmer), club)).toBe('¿Aprobar a los 6 nadadores pendientes (CAC)? Esta decisión no se puede cambiar después.')
    expect(confirmText('reject', [1, 2, 3, 4, 5, 6].map(swimmer), club)).toBe('¿Rechazar a 6 nadadores (CAC)? Esta decisión no se puede cambiar después.')
  })

  it.each([
    ['approve', 1, 1, 'Aprobaste a 1 nadador de CAC. Queda 1 por revisar.'],
    ['approve', 2, 0, 'Aprobaste a 2 nadadores de CAC. La tardía de CAC quedó revisada.'],
    ['reject', 1, 0, 'Rechazaste a 1 nadador de CAC. La tardía de CAC quedó revisada.'],
    ['approve_pending', 4, 0, 'Aprobaste a los 4 nadadores pendientes de CAC. La tardía de CAC quedó revisada.'],
    ['approve_pending', 1, 0, 'Aprobaste a 1 nadador de CAC. La tardía de CAC quedó revisada.']
  ])('resultado %s ×%i (quedan %i)', (action, count, remaining, text) => {
    expect(reviewSuccessText(action, count, club, remaining)).toBe(text)
  })
})
