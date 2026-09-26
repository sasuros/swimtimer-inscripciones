import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.21.0 — Borrador en el servidor: guardado con PIN (sin consumir cupo), escritura por
// rev, lectura solo con PIN y nunca en la vista previa del admin, purga al enviar.
// Club 5, PIN sembrado '1234', correo club5@test.com.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: saveHandler } = await import('../../api/save-draft.js')
const { default: validateHandler } = await import('../../api/validate-token.js')
const { default: verifyHandler } = await import('../../api/verify-pin.js')
const { PIN_MAX_ATTEMPTS } = await import('./pinRateLimit.js')
const { __setSupabaseClient, generateTokens } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { MAX_DRAFT_ATHLETES, createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')

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
const call = async (handler, body, ip = '1.1.1.1', headers = {}) => {
  const res = response()
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip, ...headers } }, res)
  return res
}
const roster = (n, prefix = 'B') => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, lastName: `${prefix}${i}`, firstName: 'X', sex: 'F', age: 12, events: [] }))
const draftBody = (token, extra = {}) => ({ token, pin: '1234', roster: roster(2), base_version: 0, expected_rev: 0, ...extra })

let db, wizard, v3, v2, short
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
  short = row.short_id
  mocks.client = { from: db.from, auth: { getUser: async (jwt) => (jwt === 'jwt-admin' ? { data: { user: { id: 'admin' } }, error: null } : { data: { user: null }, error: { message: 'JWT inválido' } }) } }
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
})
afterEach(() => {
  __setSupabaseClient(null)
  delete process.env.WIZARD_ADMIN_PREVIEW
})

describe('migración y schema', () => {
  // Desde la tabla hasta el final: el schema completo tiene políticas anon de otras tablas.
  const files = ['supabase/schema.sql', 'supabase/migration_inscription_drafts.sql']
    .map((path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))
    .map((sql) => sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS inscription_drafts')))

  it('tabla aditiva con RLS, admin solo columnas permitidas + DELETE, anon nada', () => {
    for (const sql of files) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS inscription_drafts')
      expect(sql).toContain('REFERENCES events(id) ON DELETE CASCADE')
      expect(sql).toContain('PRIMARY KEY (event_id, club_code, is_late, author_key)')
      expect(sql).toContain('ALTER TABLE inscription_drafts ENABLE ROW LEVEL SECURITY')
      expect(sql).toContain('REVOKE ALL ON inscription_drafts FROM anon, authenticated')
      expect(sql).toContain('GRANT SELECT (event_id, club_code, is_late, athlete_count, updated_at) ON inscription_drafts TO authenticated')
      expect(sql).toContain('GRANT DELETE ON inscription_drafts TO authenticated')
      // Con RLS activo, sin políticas el admin no vería ni borraría nada (fallaría en silencio).
      expect(sql.match(/CREATE POLICY \w+ ON inscription_drafts FOR \w+ TO \w+/g)).toEqual([
        'CREATE POLICY drafts_admin_select ON inscription_drafts FOR SELECT TO authenticated',
        'CREATE POLICY drafts_admin_delete ON inscription_drafts FOR DELETE TO authenticated'
      ])
      expect(sql).not.toMatch(/GRANT [^;]*(roster|author_key)[^;]*TO authenticated/)
      expect(sql).not.toMatch(/TO anon/)
    }
    expect(readFileSync(new URL('../../supabase/migration_inscription_drafts.sql', import.meta.url), 'utf8')).toMatch(/BEGIN;[\s\S]*COMMIT;/)
    expect(files[1]).not.toMatch(/\b(DROP TABLE|ALTER TABLE (?!inscription_drafts)|DELETE FROM|UPDATE )/)
  })
})

describe('guardar el borrador', () => {
  it('con PIN correcto: inserta rev 1 y luego sube por rev; el servidor cuenta los nadadores', async () => {
    const first = await call(saveHandler, draftBody(v3))
    expect(first.statusCode).toBe(200)
    expect(first.body).toEqual({ saved: true, rev: 1 })
    const second = await call(saveHandler, draftBody(v3, { roster: roster(3), expected_rev: 1 }))
    expect(second.body).toEqual({ saved: true, rev: 2 })
    expect(db.tables.inscription_drafts).toHaveLength(1)
    expect(db.tables.inscription_drafts[0]).toMatchObject({ event_id: 'evt-1', club_code: 5, is_late: false, author_key: 'club5@test.com', athlete_count: 3, base_version: 0, rev: 2 })
  })

  it('rev viejo (otro dispositivo guardó antes): 409 draftConflict y no pisa nada', async () => {
    await call(saveHandler, draftBody(v3))
    await call(saveHandler, draftBody(v3, { roster: roster(4, 'OTRO'), expected_rev: 1 }))
    const stale = await call(saveHandler, draftBody(v3, { roster: roster(1, 'VIEJO'), expected_rev: 1 }))
    expect(stale.statusCode).toBe(409)
    expect(stale.body.draftConflict).toBe(true)
    const again = await call(saveHandler, draftBody(v3, { roster: roster(1, 'VIEJO'), expected_rev: 0 }))
    expect(again.statusCode).toBe(409)
    expect(db.tables.inscription_drafts[0]).toMatchObject({ rev: 2, athlete_count: 4 })
  })

  it('autor: el correo para el v3; "link" para el v2 y su corto (el mismo borrador)', async () => {
    await call(saveHandler, draftBody(v2))
    expect((await call(saveHandler, draftBody(short, { expected_rev: 1 }))).body).toEqual({ saved: true, rev: 2 })
    await call(saveHandler, draftBody(v3))
    expect(db.tables.inscription_drafts.map((row) => row.author_key).sort()).toEqual(['club5@test.com', 'link'])
  })

  it('basado en una inscripción ya superada: 409 staleBase', async () => {
    await wizard.submitInscription(payload(v3, 2, 'ENVIADO'))
    const res = await call(saveHandler, draftBody(v3, { base_version: 0 }))
    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({ staleBase: true, currentVersion: 1 })
    expect((await call(saveHandler, draftBody(v3, { base_version: 1 }))).statusCode).toBe(200)
  })

  it('evento no abierto, tardía ya revisada, datos inválidos o demasiado grandes: no guarda', async () => {
    db.tables.events[0].status = 'closed'
    expect((await call(saveHandler, draftBody(v3))).statusCode).toBe(409)
    db.tables.events[0].status = 'active'
    expect((await call(saveHandler, draftBody(v3, { roster: 'x' }))).statusCode).toBe(400)
    expect((await call(saveHandler, draftBody(v3, { expected_rev: -1 }))).statusCode).toBe(400)
    expect((await call(saveHandler, draftBody(v3, { roster: roster(MAX_DRAFT_ATHLETES + 1) }))).statusCode).toBe(413)
    expect((await call(saveHandler, draftBody('no-es-un-token'))).statusCode).toBe(400)

    db.tables.events[0].status = 'accepting_late'
    await wizard.submitInscription(payload(v3, 1, 'TARDIA'))
    Object.assign(db.tables.inscriptions.find((row) => row.is_late), { late_status: 'rejected', rejected_athletes: [5001] })
    const decided = await call(saveHandler, draftBody(v3, { base_version: 1 }))
    expect(decided.statusCode).toBe(409)
    expect(decided.body.lateDecided).toBe(true)
    expect(db.tables.inscription_drafts).toHaveLength(0)
  })
})

describe('PIN y límite de intentos al guardar', () => {
  it('PIN correcto: no registra ningún intento (no consume cupo)', async () => {
    for (let i = 0; i < PIN_MAX_ATTEMPTS + 3; i += 1) {
      expect((await call(saveHandler, draftBody(v3, { expected_rev: i }))).statusCode).toBe(200)
    }
    expect(db.tables.pin_attempts).toHaveLength(0)
  })

  it('PIN incorrecto o faltante: 401 y cuenta como intento; nada se guarda', async () => {
    expect((await call(saveHandler, draftBody(v3, { pin: '9999' }))).statusCode).toBe(401)
    expect((await call(saveHandler, draftBody(v3, { pin: '' }))).statusCode).toBe(401)
    expect(db.tables.pin_attempts).toHaveLength(2)
    expect(db.tables.inscription_drafts).toHaveLength(0)
  })

  it('par bloqueado: 429 aunque el PIN sea correcto (no es un atajo para adivinarlo)', async () => {
    await Promise.all(Array.from({ length: PIN_MAX_ATTEMPTS }, () => call(verifyHandler, { token: v3, pin: '9999' })))
    const res = await call(saveHandler, draftBody(v3))
    expect(res.statusCode).toBe(429)
    expect(res.body.retryAfter).toBeGreaterThan(0)
    expect(db.tables.inscription_drafts).toHaveLength(0)
    // Otra IP no está bloqueada.
    expect((await call(saveHandler, draftBody(v3), '2.2.2.2')).statusCode).toBe(200)
  })

  it('la vista previa del admin no guarda borradores (exige PIN)', async () => {
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    const res = await call(saveHandler, draftBody(v3, { pin: undefined }), '1.1.1.1', { authorization: 'Bearer jwt-admin' })
    expect(res.statusCode).toBe(401)
    expect(db.tables.inscription_drafts).toHaveLength(0)
  })
})

describe('leer el borrador: solo con PIN y nunca para el admin', () => {
  beforeEach(async () => {
    await call(saveHandler, draftBody(v3, { roster: roster(2, 'BORRADOR') }))
  })

  it('con PIN correcto llega el borrador del autor (roster, base_version, rev)', async () => {
    const res = await call(validateHandler, { token: v3, pin: '1234' })
    expect(res.body.draft).toMatchObject({ roster: roster(2, 'BORRADOR'), base_version: 0, rev: 1 })
    // El v2 es otro autor ('link'): no ve el borrador del correo.
    expect((await call(validateHandler, { token: v2, pin: '1234' })).body.draft).toBeNull()
  })

  it('sin PIN, con PIN incorrecto o con el evento cerrado: no viaja', async () => {
    for (const pin of [undefined, '9999']) {
      const res = await call(validateHandler, { token: v3, pin })
      expect(res.body).not.toHaveProperty('draft')
      expect(JSON.stringify(res.body)).not.toContain('BORRADOR')
    }
    db.tables.events[0].status = 'closed'
    expect(JSON.stringify((await call(validateHandler, { token: v3, pin: '1234' })).body)).not.toContain('BORRADOR')
  })

  it('vista previa del admin: acceso completo pero sin el borrador', async () => {
    process.env.WIZARD_ADMIN_PREVIEW = 'enabled'
    const res = await call(validateHandler, { token: v3 }, '1.1.1.1', { authorization: 'Bearer jwt-admin' })
    expect(res.body.pinVerified).toBe(true)
    expect(res.body).not.toHaveProperty('draft')
    expect(JSON.stringify(res.body)).not.toContain('BORRADOR')
  })
})

describe('purga al enviar y tabla ausente', () => {
  it('enviar con éxito borra los borradores del club para ese tipo (todos los autores)', async () => {
    await call(saveHandler, draftBody(v3))
    await call(saveHandler, draftBody(v2))
    db.tables.inscription_drafts.push({ event_id: 'evt-1', club_code: 6, is_late: false, author_key: 'link', roster: [], athlete_count: 1, base_version: 0, rev: 1 })
    db.tables.inscription_drafts.push({ event_id: 'evt-1', club_code: 5, is_late: true, author_key: 'link', roster: [], athlete_count: 1, base_version: 0, rev: 1 })
    await wizard.submitInscription(payload(v3, 2, 'ENVIADO'))
    expect(db.tables.inscription_drafts.map((row) => `${row.club_code}:${row.is_late}`).sort()).toEqual(['5:true', '6:false'])
  })

  it('un envío rechazado (conflicto) no purga', async () => {
    await wizard.submitInscription(payload(v3, 2, 'PRIMERO'))
    await call(saveHandler, draftBody(v3, { base_version: 1 }))
    await expect(wizard.submitInscription({ ...payload(v3, 3, 'VIEJO'), expected_version: 0 })).rejects.toMatchObject({ status: 409 })
    expect(db.tables.inscription_drafts).toHaveLength(1)
  })

  it('sin la tabla: validar con PIN y enviar siguen funcionando; guardar falla sin romper nada', async () => {
    const missing = { message: 'relation "public.inscription_drafts" does not exist', code: '42P01' }
    const broken = {
      from(table) {
        if (table !== 'inscription_drafts') return db.from(table)
        const builder = { then: (resolve) => resolve({ data: null, error: missing }) }
        for (const method of ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle']) builder[method] = () => builder
        return builder
      }
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.client = { ...mocks.client, from: broken.from }
    const access = await call(validateHandler, { token: v3, pin: '1234' })
    expect(access.body).toMatchObject({ valid: true, pinVerified: true, draft: null })
    const failed = await call(saveHandler, draftBody(v3))
    expect(failed.statusCode).toBe(500)
    const brokenWizard = createSupabaseWizardStorage({ client: broken, adminPassword: MAGIC_SIGNING_KEY })
    await expect(brokenWizard.submitInscription(payload(v3, 2, 'ENVIADO'))).resolves.toMatchObject({ success: true })
  })
})
