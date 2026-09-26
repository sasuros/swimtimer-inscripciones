import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.20.1 — Sin VITE_ADMIN_PASSWORD (o vacía) el servidor falla cerrado: 503 y nunca
// una clave por defecto conocida.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: validateHandler } = await import('../../api/validate-token.js')
const { default: submitHandler } = await import('../../api/submit-inscription.js')
const { default: verifyHandler } = await import('../../api/verify-pin.js')
const { __setSupabaseClient } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { createMagicToken } = await import('../utils/magicToken.js')

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
const call = async (handler, body) => {
  const res = response()
  await handler({ method: 'POST', body, headers: {} }, res)
  return res
}

const original = process.env.VITE_ADMIN_PASSWORD
let token
beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  const seeded = await seed()
  mocks.client = seeded.db
  token = seeded.token
})
afterEach(() => {
  process.env.VITE_ADMIN_PASSWORD = original
  __setSupabaseClient(null)
})

describe('sin clave de firma el servidor falla cerrado', () => {
  it.each([['ausente', undefined], ['vacía', ''], ['solo espacios', '   ']])('clave %s → 503 "Servidor mal configurado" en los tres endpoints', async (_name, value) => {
    if (value === undefined) delete process.env.VITE_ADMIN_PASSWORD
    else process.env.VITE_ADMIN_PASSWORD = value
    const responses = [
      await call(validateHandler, { token, pin: '1234' }),
      await call(verifyHandler, { token, pin: '1234' }),
      await call(submitHandler, payload(token, 1))
    ]
    for (const res of responses) {
      expect(res.statusCode).toBe(503)
      expect(res.body).toEqual({ error: 'Servidor mal configurado' })
    }
  })

  it('sin clave no se guarda nada', async () => {
    delete process.env.VITE_ADMIN_PASSWORD
    await call(submitHandler, payload(token, 1))
    expect(mocks.client.tables.inscriptions).toHaveLength(0)
  })

  it('con la clave configurada todo sigue igual', async () => {
    const res = await call(validateHandler, { token, pin: '1234' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ valid: true, pinVerified: true })
  })

  it('createSupabaseWizardStorage sin clave lanza en vez de usar una por defecto', () => {
    for (const adminPassword of [undefined, '', '  ']) {
      expect(() => createSupabaseWizardStorage({ client: mocks.client, adminPassword })).toThrow('Servidor mal configurado')
    }
  })

  it('createMagicToken no firma con una clave vacía', async () => {
    await expect(createMagicToken({ eventId: 'evt-1', clubCode: 5, email: 'club5@test.com' }, '')).rejects.toThrow('Falta la clave de firma')
  })
})

describe('la clave por defecto de antes no aparece en el código', () => {
  const OLD_DEFAULT = ['swim', 'timer', '2025'].join('')
  const files = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.(js|jsx)$/.test(name) ? [path] : []
  })

  it.each(['src', 'api'])('%s/ no contiene la clave por defecto', (dir) => {
    const offenders = files(dir).filter((path) => readFileSync(path, 'utf-8').includes(OLD_DEFAULT))
    expect(offenders).toEqual([])
  })
})
