import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { generateEmailHTML } from './send-invitation'

const getUser = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser }
  }))
}))

const response = () => {
  const result = { statusCode: 200, body: null }
  return {
    result,
    status(code) {
      result.statusCode = code
      return this
    },
    json(body) {
      result.body = body
      return this
    }
  }
}

describe('correo de invitacion', () => {
  beforeEach(() => {
    getUser.mockReset()
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  })

  it('genera el boton y escapa datos dinamicos', () => {
    const html = generateEmailHTML({
      clubName: '<Club>',
      eventName: 'Copa',
      eventDate: '2026-12-01',
      venue: '',
      deadline: '',
      magicLink: 'https://example.com/token',
      email: 'coach@example.com',
      pin: '4827'
    })
    expect(html).toContain('INSCRIBIR NADADORES')
    expect(html).toContain('https://example.com/token')
    expect(html).toContain('&lt;Club&gt;')
    expect(html).not.toContain('<Club>')
    expect(html).toContain('4827')
    expect(html).toContain('Tu código de acceso')
  })

  // v1.19.1: todo el correo en tú, con tildes, y el enlace se comparte dentro del club.
  it('habla en tú, declara UTF-8 y explica cómo volver y compartir el enlace', () => {
    const html = generateEmailHTML({
      clubName: 'CAC',
      eventName: 'Copa',
      eventDate: '2026-12-01',
      venue: 'Sede',
      deadline: '2026-11-20',
      magicLink: 'https://example.com/token',
      email: 'coach@example.com',
      pin: '4827'
    })
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('Te invitamos a inscribir a los nadadores de')
    expect(html).toContain('Fecha límite: 2026-11-20')
    expect(html).toContain('Puedes volver a abrir este enlace cuando quieras para agregar o corregir nadadores.')
    expect(html).toContain('Si otro entrenador de tu club necesita inscribir, compártele este enlace junto con el código. No lo compartas fuera de tu club.')
    expect(html).toContain('Si tienes problemas para entrar, escríbele al organizador del evento.')
    expect(html).not.toMatch(/\busted\b|Ha sido invitado|\bcomparta\b|\bcontacte\b|Si tiene\b|exclusivo para/i)
    expect(html).not.toMatch(/codigo|limite|Invitacion|Necesitaras|inscripcion\b/)
  })

  it('rechaza metodos distintos de POST', async () => {
    const res = response()
    await handler({ method: 'GET' }, res)
    expect(res.result.statusCode).toBe(405)
  })

  it('rechaza requests sin JWT de Supabase', async () => {
    const res = response()
    await handler({ method: 'POST', headers: {}, body: { invitations: [] } }, res)
    expect(res.result.statusCode).toBe(401)
  })

  it('rechaza un JWT invalido', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const res = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer token-malo' }, body: { invitations: [] } }, res)
    expect(res.result.statusCode).toBe(401)
  })

  it('informa cuando Resend no esta configurado despues de validar usuario', async () => {
    const previous = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const res = response()
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer token-valido' },
        body: { invitations: [{}] }
      },
      res
    )
    expect(res.result).toMatchObject({
      statusCode: 503,
      body: { error: 'Resend no esta configurado' }
    })
    if (previous) process.env.RESEND_API_KEY = previous
  })
})
