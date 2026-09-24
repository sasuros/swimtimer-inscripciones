import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.16.1 — Límite de intentos del PIN por (IP + token canónico). Club 5, PIN sembrado '1234'.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: validateHandler } = await import('../../api/validate-token.js')
const { default: submitHandler } = await import('../../api/submit-inscription.js')
const { default: verifyHandler } = await import('../../api/verify-pin.js')
const { clientIpKey, ipKeyFrom } = await import('../../api/_clientIp.js')
const { PIN_MAX_ATTEMPTS, PIN_WINDOW_MS, checkPinRateLimit } = await import('./pinRateLimit.js')
const { __setSupabaseClient, generateTokens } = await import('./supabaseStorage.js')
const { createFakeSupabase, payload, seed } = await import('./testSupport/fakeSupabase.js')
const { tokenKey } = await import('./wizardSupabase.js')

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
const fail = (token, ip, times = PIN_MAX_ATTEMPTS) => Promise.all(Array.from({ length: times }, () => call(verifyHandler, { token, pin: '9999' }, ip)))

let db, v2, v3, shortId
beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  delete process.env.WIZARD_ADMIN_PREVIEW
  const seeded = await seed()
  db = seeded.db
  v3 = seeded.token
  await generateTokens('evt-1')
  const row = db.tables.tokens.find((item) => item.token_type === 'v2' && item.club_code === 5)
  v2 = row.token_value
  shortId = row.short_id
  mocks.client = { from: db.from, auth: { getUser: async (jwt) => (jwt === 'jwt-admin' ? { data: { user: { id: 'admin' } }, error: null } : { data: { user: null }, error: { message: 'JWT inválido' } }) } }
})
afterEach(() => {
  __setSupabaseClient(null)
  delete process.env.WIZARD_ADMIN_PREVIEW
  vi.restoreAllMocks()
})

describe('bloqueo por (IP + token)', () => {
  it(`tras ${PIN_MAX_ATTEMPTS} fallos, el intento siguiente se rechaza con 429 aunque el PIN sea correcto`, async () => {
    const fails = await fail(v2, '1.1.1.1')
    expect(fails.every((res) => res.statusCode === 200 && res.body.valid === false)).toBe(true)
    const blocked = await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')
    expect(blocked.statusCode).toBe(429)
    expect(blocked.body.error).toMatch(/Demasiados intentos/)
    expect(blocked.body.retryAfter).toBeGreaterThan(0)
    expect(blocked.body.retryAfter).toBeLessThanOrEqual(PIN_WINDOW_MS / 1000)
  })

  it('otra IP con el mismo token no se ve afectada (no hay bloqueo por club)', async () => {
    await fail(v2, '1.1.1.1', PIN_MAX_ATTEMPTS + 3)
    const other = await call(verifyHandler, { token: v2, pin: '1234' }, '2.2.2.2')
    expect(other.statusCode).toBe(200)
    expect(other.body).toEqual({ valid: true })
    const submit = await call(submitHandler, payload(v2, 1, 'OK'), '2.2.2.2')
    expect(submit.statusCode).toBe(200)
    expect(submit.body.success).toBe(true)
  })

  it('la misma IP con otro token no se ve afectada', async () => {
    await fail(v2, '1.1.1.1', PIN_MAX_ATTEMPTS + 1)
    const res = await call(verifyHandler, { token: v3, pin: '1234' }, '1.1.1.1')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ valid: true })
  })

  it('un PIN correcto antes del umbral resetea el contador del par', async () => {
    await fail(v2, '1.1.1.1', PIN_MAX_ATTEMPTS - 1)
    expect((await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')).body).toEqual({ valid: true })
    expect(db.tables.pin_attempts).toHaveLength(0)
    await fail(v2, '1.1.1.1', PIN_MAX_ATTEMPTS - 1)
    const again = await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')
    expect(again.statusCode).toBe(200)
    expect(again.body).toEqual({ valid: true })
  })

  it('el enlace corto y el largo comparten contador (clave = token canónico)', async () => {
    expect(shortId).toMatch(/^[A-Za-z0-9]{10}$/)
    await fail(shortId, '1.1.1.1', PIN_MAX_ATTEMPTS / 2)
    await fail(v2, '1.1.1.1', PIN_MAX_ATTEMPTS / 2)
    expect((await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')).statusCode).toBe(429)
    expect((await call(verifyHandler, { token: shortId, pin: '1234' }, '1.1.1.1')).statusCode).toBe(429)
    const keys = new Set(db.tables.pin_attempts.map((row) => row.token_key))
    expect([...keys]).toEqual([await tokenKey(v2)])
  })
})

describe('los tres endpoints están cubiertos', () => {
  beforeEach(() => fail(v2, '1.1.1.1'))

  it('/api/verify-pin → 429', async () => {
    expect((await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')).statusCode).toBe(429)
  })

  it('/api/validate-token con PIN → 200 con rateLimited, solo lo básico y sin roster', async () => {
    await call(submitHandler, payload(v2, 2, 'PREVIO'), '9.9.9.9')
    const res = await call(validateHandler, { token: v2, pin: '1234' }, '1.1.1.1')
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ valid: true, requiresPin: true, pinVerified: false, rateLimited: true })
    expect(res.body.retryAfter).toBeGreaterThan(0)
    for (const key of ['inscription', 'normal_inscription', 'already_submitted']) expect(res.body).not.toHaveProperty(key)
    expect(JSON.stringify(res.body)).not.toContain('PREVIO')
  })

  it('/api/submit-inscription → 429 y no se escribe nada', async () => {
    const before = db.tables.inscriptions.length
    const res = await call(submitHandler, payload(v2, 1, 'ATACANTE'), '1.1.1.1')
    expect(res.statusCode).toBe(429)
    expect(res.body.error).toMatch(/Demasiados intentos/)
    expect(db.tables.inscriptions).toHaveLength(before)
  })
})

describe('qué NO cuenta como intento', () => {
  it('validate-token sin PIN (primera carga) no suma ni queda bloqueado', async () => {
    for (let i = 0; i < PIN_MAX_ATTEMPTS + 5; i += 1) await call(validateHandler, { token: v2 }, '1.1.1.1')
    expect(db.tables.pin_attempts).toHaveLength(0)
    const res = await call(validateHandler, { token: v2, pin: '1234' }, '1.1.1.1')
    expect(res.body).toMatchObject({ pinVerified: true })
  })

  it('un token inexistente no suma filas', async () => {
    await call(verifyHandler, { token: 'ZZZZZZZZZZ', pin: '1234' }, '1.1.1.1')
    expect(db.tables.pin_attempts).toHaveLength(0)
  })

  it('la vista previa del admin no cuenta ni se bloquea', async () => {
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    await fail(v2, '1.1.1.1')
    const res = await call(validateHandler, { token: v2 }, '1.1.1.1', { authorization: 'Bearer jwt-admin' })
    expect(res.body).toMatchObject({ pinVerified: true })
  })
})

describe('checkPinRateLimit', () => {
  const T0 = Date.parse('2026-10-01T12:00:00Z')

  it('FALLA ABIERTO ante error de la base: deja pasar con un warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = { from: () => { throw new Error('relation "pin_attempts" does not exist') } }
    expect(await checkPinRateLimit(broken, '1.1.1.1', 'k')).toEqual({ limited: false })
    const erroring = createFakeSupabase()
    const from = erroring.from
    erroring.from = (table) => {
      const builder = from(table)
      builder.then = (resolve) => resolve({ data: null, error: { message: 'timeout' } })
      return builder
    }
    expect(await checkPinRateLimit(erroring, '1.1.1.1', 'k')).toEqual({ limited: false })
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('con la tabla caída, el endpoint sigue validando el PIN (no bloquea la inscripción)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete db.tables.pin_attempts
    const from = db.from
    mocks.client = { ...mocks.client, from: (table) => (table === 'pin_attempts' ? { delete: () => { throw new Error('no existe') }, insert: () => { throw new Error('no existe') } } : from(table)) }
    for (let i = 0; i < PIN_MAX_ATTEMPTS + 3; i += 1) await call(verifyHandler, { token: v2, pin: '9999' }, '1.1.1.1')
    expect((await call(verifyHandler, { token: v2, pin: '1234' }, '1.1.1.1')).body).toEqual({ valid: true })
    expect((await call(submitHandler, payload(v2, 1, 'OK'), '1.1.1.1')).statusCode).toBe(200)
  })

  it('la ventana vence: pasados 15 minutos vuelve a dejar pasar', async () => {
    const fake = createFakeSupabase()
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) await checkPinRateLimit(fake, 'ip', 'k', { now: T0 + i })
    expect(await checkPinRateLimit(fake, 'ip', 'k', { now: T0 + 100 })).toMatchObject({ limited: true })
    expect(await checkPinRateLimit(fake, 'ip', 'k', { now: T0 + PIN_WINDOW_MS + 200 })).toEqual({ limited: false })
  })

  it('poda las filas viejas del par en cada chequeo (y no toca otros pares)', async () => {
    const fake = createFakeSupabase()
    for (let i = 0; i < 5; i += 1) await checkPinRateLimit(fake, 'ip', 'k', { now: T0 })
    await checkPinRateLimit(fake, 'otra-ip', 'k', { now: T0 })
    await checkPinRateLimit(fake, 'ip', 'k', { now: T0 + PIN_WINDOW_MS + 1 })
    expect(fake.tables.pin_attempts.filter((row) => row.ip_key === 'ip')).toHaveLength(1)
    expect(fake.tables.pin_attempts.filter((row) => row.ip_key === 'otra-ip')).toHaveLength(1)
  })
})

describe('clientIpKey', () => {
  it('toma el primer valor de x-forwarded-for; cae a x-real-ip; sin IP → unknown', () => {
    expect(clientIpKey({ headers: { 'x-forwarded-for': '146.70.202.116, 10.0.0.1' } })).toBe('146.70.202.116')
    expect(clientIpKey({ headers: { 'x-real-ip': '8.8.8.8' } })).toBe('8.8.8.8')
    expect(clientIpKey({ headers: {} })).toBe('unknown')
    expect(clientIpKey({})).toBe('unknown')
  })

  it('IPv6 se agrupa por /64 (misma red → misma clave)', () => {
    expect(ipKeyFrom('2001:db8:abcd:12:1::5')).toBe('2001:db8:abcd:12::/64')
    expect(ipKeyFrom('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff')).toBe('2001:db8:abcd:12::/64')
    expect(ipKeyFrom('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ipKeyFrom('2001:db8:abcd:13::1')).not.toBe(ipKeyFrom('2001:db8:abcd:12::1'))
    expect(ipKeyFrom('::ffff:1.2.3.4')).toBe('1.2.3.4')
  })
})
