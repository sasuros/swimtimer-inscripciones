import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Los handlers crean su cliente con createClient: lo reemplazamos por el fake en memoria.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: validateHandler } = await import('../../api/validate-token.js')
const { default: submitHandler } = await import('../../api/submit-inscription.js')
const { default: verifyHandler } = await import('../../api/verify-pin.js')
const { __setSupabaseClient, generateTokens } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { DEMO_ADMIN_PASSWORD } = await import('../config.js')

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
const call = async (handler, body, headers = {}) => {
  const res = response()
  await handler({ method: 'POST', body, headers }, res)
  return res
}

let v2
beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  delete process.env.WIZARD_ADMIN_PREVIEW
  const { db } = await seed()
  await generateTokens('evt-1')
  v2 = db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === 5).token_value
  await createSupabaseWizardStorage({ client: db, adminPassword: DEMO_ADMIN_PASSWORD }).submitInscription(payload(v2, 2, 'PREVIO'))
  // Sesión de Supabase: solo "jwt-admin" es un usuario válido.
  mocks.client = { from: db.from, auth: { getUser: async (jwt) => (jwt === 'jwt-admin' ? { data: { user: { id: 'admin' } }, error: null } : { data: { user: null }, error: { message: 'JWT inválido' } }) } }
})
afterEach(() => {
  __setSupabaseClient(null)
  delete process.env.WIZARD_ADMIN_PREVIEW
})

describe('/api/validate-token', () => {
  it('token válido sin PIN: solo lo básico, sin roster', async () => {
    const res = await call(validateHandler, { token: v2 })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ valid: true, requiresPin: true, pinVerified: false })
    expect(res.body).not.toHaveProperty('inscription')
    expect(JSON.stringify(res.body)).not.toContain('PREVIO')
  })

  it('con PIN correcto devuelve el roster', async () => {
    const res = await call(validateHandler, { token: v2, pin: '1234' })
    expect(res.body.pinVerified).toBe(true)
    expect(JSON.stringify(res.body)).toContain('PREVIO0')
  })

  it('vista previa APAGADA (default): un JWT de admin válido NO saltea el PIN', async () => {
    const res = await call(validateHandler, { token: v2 }, { authorization: 'Bearer jwt-admin' })
    expect(res.body.pinVerified).toBe(false)
    expect(res.body).not.toHaveProperty('inscription')
  })

  it('vista previa HABILITADA: JWT válido entra sin PIN; JWT inválido o ausente, no', async () => {
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    expect((await call(validateHandler, { token: v2 }, { authorization: 'Bearer jwt-admin' })).body.pinVerified).toBe(true)
    expect((await call(validateHandler, { token: v2 }, { authorization: 'Bearer jwt-falso' })).body.pinVerified).toBe(false)
    expect((await call(validateHandler, { token: v2 })).body.pinVerified).toBe(false)
  })
})

describe('/api/submit-inscription', () => {
  const body = (pin) => {
    const { token, athletes, results, roster, meta } = payload(v2, 1, 'NUEVO')
    return { token, pin, athletes, results, roster, meta }
  }

  it('sin PIN responde 401 y no pisa el roster', async () => {
    const res = await call(submitHandler, body(undefined))
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toMatch(/Código de acceso/)
  })

  it('con PIN correcto responde 200', async () => {
    expect((await call(submitHandler, body('1234'))).statusCode).toBe(200)
  })

  it('admin: sin PIN solo pasa con vista previa habilitada y JWT válido', async () => {
    expect((await call(submitHandler, body(undefined), { authorization: 'Bearer jwt-admin' })).statusCode).toBe(401)
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    expect((await call(submitHandler, body(undefined), { authorization: 'Bearer jwt-falso' })).statusCode).toBe(401)
    expect((await call(submitHandler, body(undefined), { authorization: 'Bearer jwt-admin' })).statusCode).toBe(200)
  })
})

describe('/api/verify-pin', () => {
  it('verifica el PIN de un enlace v2', async () => {
    expect((await call(verifyHandler, { token: v2, pin: '1234' })).body).toEqual({ valid: true })
    expect((await call(verifyHandler, { token: v2, pin: '0000' })).body).toEqual({ valid: false })
  })
})
