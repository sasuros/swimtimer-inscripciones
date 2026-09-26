import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.19.2 — Enlace vigente de un evento que no recibe inscripciones. Antes, el enlace del
// correo (v3) con el evento cerrado respondía { valid: false } y el entrenador veía "no es
// válido o ya expiró". Ahora: acceso básico (sin roster, con o sin PIN, ni para el admin) y
// la pantalla de "cerradas" / "todavía no abiertas". Club 5, PIN sembrado '1234'.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: validateHandler } = await import('../../api/validate-token.js')
const { default: submitHandler } = await import('../../api/submit-inscription.js')
const { default: verifyHandler } = await import('../../api/verify-pin.js')
const { PIN_MAX_ATTEMPTS } = await import('./pinRateLimit.js')
const { __setSupabaseClient, generateTokens } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { CLOSED_TEXT, NOT_OPEN_YET_TEXT } = await import('../utils/registrationStatus.js')

const response = () => ({
  statusCode: 0,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})
const call = async (handler, body, ip = '1.1.1.1', extraHeaders = {}) => {
  const res = response()
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip, ...extraHeaders } }, res)
  return res
}
const ROSTER_KEYS = ['inscription', 'normal_inscription', 'already_submitted']

let db, links
beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  delete process.env.WIZARD_ADMIN_PREVIEW
  const seeded = await seed()
  db = seeded.db
  await generateTokens('evt-1')
  const v2 = db.tables.tokens.find((item) => item.token_type === 'v2' && item.club_code === 5)
  links = { 'v3 (correo)': seeded.token, v2: v2.token_value, corto: v2.short_id }
  mocks.client = { from: db.from, auth: { getUser: async (jwt) => (jwt === 'jwt-admin' ? { data: { user: { id: 'admin' } }, error: null } : { data: { user: null }, error: { message: 'JWT inválido' } }) } }
  // Con el evento abierto, el club envía: hay roster guardado que proteger.
  const sent = await call(submitHandler, payload(seeded.token, 2, 'Secreto'))
  expect(sent.statusCode).toBe(200)
})
afterEach(() => {
  __setSupabaseClient(null)
  delete process.env.WIZARD_ADMIN_PREVIEW
})

const setStatus = (status) => {
  db.tables.events[0].status = status
}

describe('validate-token en los cinco estados', () => {
  it.each(['active', 'accepting_late'])('%s: con PIN correcto hay acceso completo (como siempre)', async (status) => {
    setStatus(status)
    for (const token of Object.values(links)) {
      const res = await call(validateHandler, { token, pin: '1234' })
      expect(res.body).toMatchObject({ valid: true, pinVerified: true })
      expect(res.body.normal_inscription.roster).toHaveLength(2)
    }
  })

  it.each(['closed', 'archived', 'draft'])('%s: el enlace sigue siendo válido y trae el estado del evento', async (status) => {
    setStatus(status)
    for (const [name, token] of Object.entries(links)) {
      const res = await call(validateHandler, { token })
      expect(res.statusCode, name).toBe(200)
      expect(res.body, name).toMatchObject({ valid: true, pinVerified: false, event: { name: 'Copa Test', status } })
    }
  })

  it.each(['closed', 'archived', 'draft'])('%s: NUNCA devuelve el roster, sin PIN, con PIN correcto ni en la vista previa del admin', async (status) => {
    setStatus(status)
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    for (const [name, token] of Object.entries(links)) {
      for (const [how, body, headers] of [['sin PIN', { token }, {}], ['PIN correcto', { token, pin: '1234' }, {}], ['admin', { token }, { authorization: 'Bearer jwt-admin' }]]) {
        const res = await call(validateHandler, body, '1.1.1.1', headers)
        expect(res.body.valid, `${name} ${how}`).toBe(true)
        expect(res.body.pinVerified, `${name} ${how}`).toBe(false)
        for (const key of ROSTER_KEYS) expect(res.body, `${name} ${how}`).not.toHaveProperty(key)
        expect(JSON.stringify(res.body), `${name} ${how}`).not.toContain('Secreto')
      }
    }
  })
})

describe('el envío a un evento no abierto sigue rechazado, sin escribir nada', () => {
  it.each([['closed', CLOSED_TEXT], ['archived', CLOSED_TEXT], ['draft', NOT_OPEN_YET_TEXT]])('%s → 400 "%s"', async (status, text) => {
    setStatus(status)
    const before = JSON.stringify(db.tables.inscriptions)
    for (const token of Object.values(links)) {
      for (const pin of ['1234', '9999']) {
        const res = await call(submitHandler, payload(token, 3, 'Nuevo', pin))
        expect(res.statusCode).toBe(400)
        expect(res.body.error).toBe(text)
      }
    }
    expect(JSON.stringify(db.tables.inscriptions)).toBe(before)
  })
})

describe('PIN: verify-pin y el límite de intentos no cambian', () => {
  it('con el evento cerrado, verify-pin sigue comprobando el PIN y bloqueando tras los intentos', async () => {
    setStatus('closed')
    const token = links['v3 (correo)']
    expect((await call(verifyHandler, { token, pin: '1234' }, '2.2.2.2')).body).toEqual({ valid: true })
    expect((await call(verifyHandler, { token, pin: '9999' }, '2.2.2.2')).body).toEqual({ valid: false })
    for (let i = 1; i < PIN_MAX_ATTEMPTS; i += 1) await call(verifyHandler, { token, pin: '9999' }, '3.3.3.3')
    await call(verifyHandler, { token, pin: '9999' }, '3.3.3.3')
    expect((await call(verifyHandler, { token, pin: '1234' }, '3.3.3.3')).statusCode).toBe(429)
  })

  it('con el evento abierto, validate-token sigue contando y bloqueando los PIN fallidos', async () => {
    const token = links['v3 (correo)']
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) await call(validateHandler, { token, pin: '9999' }, '4.4.4.4')
    const res = await call(validateHandler, { token, pin: '1234' }, '4.4.4.4')
    expect(res.body).toMatchObject({ rateLimited: true, pinVerified: false })
  })
})
