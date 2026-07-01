import { describe, expect, it } from 'vitest'
import handler, { generateEmailHTML } from './send-invitation'

const response = () => {
  const result = { statusCode: 200, body: null }
  return {
    result,
    status(code) { result.statusCode = code; return this },
    json(body) { result.body = body; return this }
  }
}

describe('correo de invitación', () => {
  it('genera el botón y escapa datos dinámicos', () => {
    const html = generateEmailHTML({ clubName: '<Club>', eventName: 'Copa', eventDate: '2026-12-01', venue: '', deadline: '', magicLink: 'https://example.com/token', email: 'coach@example.com' })
    expect(html).toContain('INSCRIBIR NADADORES')
    expect(html).toContain('https://example.com/token')
    expect(html).toContain('&lt;Club&gt;')
    expect(html).not.toContain('<Club>')
  })

  it('rechaza métodos distintos de POST', async () => {
    const res = response()
    await handler({ method: 'GET' }, res)
    expect(res.result.statusCode).toBe(405)
  })

  it('rechaza una contraseña incorrecta', async () => {
    const res = response()
    await handler({ method: 'POST', body: { password: 'incorrecta', invitations: [] } }, res)
    expect(res.result.statusCode).toBe(401)
  })

  it('informa cuando Resend no está configurado', async () => {
    const previous = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    const res = response()
    await handler({ method: 'POST', body: { password: 'swimtimer2025', invitations: [{}] } }, res)
    expect(res.result).toMatchObject({ statusCode: 503, body: { error: 'Resend no está configurado' } })
    if (previous) process.env.RESEND_API_KEY = previous
  })
})
