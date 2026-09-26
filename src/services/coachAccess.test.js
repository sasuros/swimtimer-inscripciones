import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.20.1 — El entrenador recibe SOLO los datos de su club y el contacto del organizador.
// Antes, validate-token devolvía event.clubs completo (correo, WhatsApp y contacto de los
// demás clubes, incluso sin PIN) y columnas internas del evento (notes, imported_from…).
// Lista blanca del evento: los campos que el wizard realmente lee.
const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: validateHandler } = await import('../../api/validate-token.js')
const { __setSupabaseClient, generateTokens } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')

const COACH_EVENT_FIELDS = ['deadline', 'events', 'name', 'organizer', 'organizer_whatsapp', 'reference_date', 'status']
const OTHER_CLUB = { email: 'club6@ficticio.test', whatsapp: '584149990456', contact: 'Contacto Club Seis' }
const INTERNAL = ['NOTA-INTERNA-DEL-ADMIN', 'ORIGEN-INTERNO-MM', 'https://drive.ficticio.test/carpeta']

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

let db, wizard, v3, v2
beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
  const seeded = await seed()
  db = seeded.db
  v3 = seeded.token
  mocks.client = db
  Object.assign(db.tables.events[0], {
    organizer: 'Organizador Ficticio',
    deadline: '2026-09-30',
    notes: INTERNAL[0],
    imported_from: { source: INTERNAL[1] },
    drive_url: INTERNAL[2]
  })
  db.tables.clubs.push({ code: 6, name: 'Club Seis', short_name: 'C6', abbreviation: 'SEI' })
  db.tables.event_clubs.push({ event_id: 'evt-1', club_code: 6, status: 'invited', contact_name: OTHER_CLUB.contact, contact_whatsapp: OTHER_CLUB.whatsapp, email: OTHER_CLUB.email, pin: '5678', invitation_sent_at: null, invitation_error: '' })
  await generateTokens('evt-1')
  v2 = db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === 5).token_value
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
})
afterEach(() => __setSupabaseClient(null))

function expectOnlyOwnData(access) {
  expect(access.valid).toBe(true)
  expect(access.club.code).toBe(5)
  expect(Object.keys(access.event).sort()).toEqual(COACH_EVENT_FIELDS)
  expect(access.event).toMatchObject({ name: 'Copa Test', organizer: 'Organizador Ficticio', organizer_whatsapp: '584120000000' })
  const serialized = JSON.stringify(access)
  for (const value of [...Object.values(OTHER_CLUB), ...INTERNAL]) expect(serialized).not.toContain(value)
}

describe('el entrenador solo recibe los datos de su club', () => {
  it.each([['v3 (correo)', () => v3], ['v2 (enlace copiado)', () => v2]])('%s sin PIN', async (_name, link) => {
    expectOnlyOwnData(await wizard.validateToken(link()))
  })

  it.each([['v3 (correo)', () => v3], ['v2 (enlace copiado)', () => v2]])('%s con PIN correcto', async (_name, link) => {
    const access = await wizard.validateToken(link(), { pin: '1234' })
    expect(access.pinVerified).toBe(true)
    expectOnlyOwnData(access)
  })

  it('con el evento cerrado (pantalla de cerradas)', async () => {
    db.tables.events[0].status = 'closed'
    expectOnlyOwnData(await wizard.validateToken(v3, { pin: '1234' }))
  })

  it('a través de /api/validate-token', async () => {
    const res = response()
    await validateHandler({ method: 'POST', body: { token: v3 }, headers: { 'x-forwarded-for': '1.1.1.1' } }, res)
    expect(res.statusCode).toBe(200)
    expectOnlyOwnData(res.body)
  })

  it('el guardado no cambia: el envío con PIN sigue escribiendo la fila del club', async () => {
    const result = await wizard.submitInscription(payload(v3, 2))
    expect(result).toMatchObject({ success: true, version: 1 })
    expect(db.tables.inscriptions.map((row) => row.club_code)).toEqual([5])
  })
})
