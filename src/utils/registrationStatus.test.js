import { describe, expect, it } from 'vitest'
import { CLOSED_TEXT, NOT_OPEN_YET_TEXT, isRegistrationOpen, notOpenText } from './registrationStatus'

describe('estados que reciben inscripciones (v1.19.2)', () => {
  it.each([['active', true], ['accepting_late', true], ['draft', false], ['closed', false], ['archived', false]])('%s → abierto: %s', (status, open) => {
    expect(isRegistrationOpen(status)).toBe(open)
  })

  it('texto del rechazo: draft "todavía no abiertas"; closed y archived "cerradas"', () => {
    expect(notOpenText('draft')).toBe(NOT_OPEN_YET_TEXT)
    expect(notOpenText('closed')).toBe(CLOSED_TEXT)
    expect(notOpenText('archived')).toBe(CLOSED_TEXT)
  })
})
