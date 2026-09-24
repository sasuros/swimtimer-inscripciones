import { describe, expect, it, vi } from 'vitest'
import { logAdminAction, pickSafe, statusAction } from './auditLog'

describe('statusAction: nombre de la acción según el cambio de estado', () => {
  it.each([
    ['draft', 'active', 'event.activated'],
    ['closed', 'active', 'event.reopened'],
    ['archived', 'active', 'event.reopened'],
    ['accepting_late', 'active', 'event.reopened'],
    ['active', 'accepting_late', 'event.closed_accepting_late'],
    ['active', 'closed', 'event.closed_final'],
    ['accepting_late', 'closed', 'event.closed_final'],
    ['closed', 'archived', 'event.archived'],
    ['active', 'active', 'event.status_changed'],
    ['closed', 'accepting_late', 'event.status_changed'],
    ['active', 'draft', 'event.status_changed'],
    [undefined, 'closed', 'event.closed_final']
  ])('%s → %s = %s', (from, to, action) => {
    expect(statusAction(from, to)).toBe(action)
  })
})

describe('pickSafe: lista blanca de claves y valores', () => {
  it('conserva solo from/to/via/campos válidos', () => {
    expect(pickSafe({ from: 'closed', to: 'active', via: 'editor', campos: ['venue', 'drive_url', 'venue'] })).toEqual({ from: 'closed', to: 'active', via: 'editor', campos: ['drive_url', 'venue'] })
  })

  it('descarta claves y valores fuera de la lista (nunca PII)', () => {
    const safe = pickSafe({ nombre: 'Ana Pérez', fecha_nacimiento: '2014-02-03', venue: 'Sede X', from: 'Ana Pérez', via: 'whatsapp', campos: ['venue', 'Ana Pérez', 42] })
    expect(safe).toEqual({ campos: ['venue'] })
    expect(JSON.stringify(safe)).not.toMatch(/Ana|2014|Sede/)
  })

  it('sin detalles devuelve objeto vacío', () => {
    expect(pickSafe()).toEqual({})
    expect(pickSafe({ campos: 'venue' })).toEqual({})
  })
})

describe('logAdminAction: no bloqueante', () => {
  it('sin cliente (modo demo) no hace nada', async () => {
    await expect(logAdminAction(null, { action: 'event.archived', eventId: 'evt-1' })).resolves.toBeUndefined()
  })

  it('inserta la fila con details filtrados y sin actor (lo pone la base)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ insert }))
    await logAdminAction({ from }, { action: 'event.reopened', eventId: 'evt-1', details: { from: 'closed', to: 'active', extra: 'x' } })
    expect(from).toHaveBeenCalledWith('audit_log')
    expect(insert).toHaveBeenCalledWith({ action: 'event.reopened', event_id: 'evt-1', club_code: null, details: { from: 'closed', to: 'active' }, outcome: 'success' })
    expect(insert.mock.calls[0][0]).not.toHaveProperty('actor')
  })

  it('si el insert devuelve error o lanza, no propaga', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const withError = { from: () => ({ insert: vi.fn().mockResolvedValue({ error: { message: 'RLS' } }) }) }
    const throwing = { from: () => ({ insert: vi.fn().mockRejectedValue(new Error('red caída')) }) }
    const exploding = { from: () => { throw new Error('sin tabla') } }
    for (const client of [withError, throwing, exploding]) {
      await expect(logAdminAction(client, { action: 'event.archived', eventId: 'evt-1' })).resolves.toBeUndefined()
    }
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})
