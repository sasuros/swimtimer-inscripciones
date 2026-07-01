import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeDemoToken } from '../utils/demoToken'
import {
  __setSupabaseClient,
  adminLogin,
  getMasterClubs,
  upsertClub,
  validateToken
} from './supabaseStorage'

afterEach(() => __setSupabaseClient(null))

describe('adaptador Supabase', () => {
  it('normaliza y guarda clubes con un cliente mock', async () => {
    const saved = { code: 6, name: 'Mantarrayas', short_name: 'MANTARRAYAS', abbreviation: 'MNT' }
    const single = vi.fn().mockResolvedValue({ data: saved, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ upsert }))
    __setSupabaseClient({ from })

    await expect(upsertClub({ code: 6, name: 'Mantarrayas', participation_status: 'invited' })).resolves.toEqual(saved)
    expect(from).toHaveBeenCalledWith('clubs')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ code: 6, name: 'Mantarrayas' }), { onConflict: 'code' })
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('participation_status')
  })

  it('lee la tabla maestra con un cliente mock', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ code: 2, name: 'AKP' }], error: null })
    const select = vi.fn(() => ({ order }))
    __setSupabaseClient({ from: vi.fn(() => ({ select })) })
    await expect(getMasterClubs()).resolves.toEqual([{ code: 2, name: 'AKP' }])
    expect(order).toHaveBeenCalledWith('name')
  })

  it('usa el token autocontenido si Supabase no está disponible', async () => {
    const token = encodeDemoToken({
      id: 'evt-1', name: 'Copa', date_start: '2026-12-10', reference_date: '2026-12-10',
      status: 'active', events: [{ event_ptr: 1, distance: 50, style: 'Crawl', age_lo: 10, age_hi: 11, sex: 'F', active: true }]
    }, { code: 2, name: 'AKP' })
    await expect(validateToken(token)).resolves.toMatchObject({ valid: true, backendAvailable: false, eventId: 'evt-1' })
  })

  it('mantiene la contraseña simple del administrador', () => {
    expect(() => adminLogin('incorrecta')).toThrow('Contraseña incorrecta')
    expect(adminLogin('swimtimer2025').token).toMatch(/^supabase-admin-/)
  })
})
