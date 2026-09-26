import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.21.0 — Un borrador NUNCA es una inscripción. Con un borrador y sin inscripción: el
// consolidado queda vacío, received 0, athlete_count 0, event_clubs.status intacto,
// "Ver inscripciones" no lo ve y el club aparece "En borrador" (sin romper ClubStatus).
// El admin ve existencia, fecha y cantidad; nunca el contenido.
const mocks = vi.hoisted(() => ({ client: null, fetch: null }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }))

const { default: keepAliveHandler } = await import('../../api/keep-alive.js')
const { __setSupabaseClient, exportConsolidated, generateTokens, getClubInscriptions, getDashboard, submitInscription, updateEventStatus } = await import('./supabaseStorage.js')
const { payload, seed } = await import('./testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('./wizardSupabase.js')
const { DRAFT_RETENTION_DAYS, purgeStaleDrafts } = await import('./draftPurge.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { ClubLinkCard, ClubStatus, DraftStatus } = await import('../pages/AdminDashboard.jsx')

const SECRET = 'NADADORA-DEL-BORRADOR'
const draftRoster = (n) => Array.from({ length: n }, (_, i) => ({ id: `B${i}`, lastName: `${SECRET}-${i}`, firstName: 'X', sex: 'F', age: 12, events: [] }))
const DAY = 24 * 60 * 60 * 1000

let db, v3, wizard
beforeEach(async () => {
  const seeded = await seed()
  db = seeded.db
  v3 = seeded.token
  await generateTokens('evt-1')
  wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  await wizard.saveDraft({ token: v3, pin: '1234', roster: draftRoster(2), base_version: 0, expected_rev: 0 })
})
afterEach(() => {
  __setSupabaseClient(null)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('filtración: el borrador no es una inscripción', () => {
  it('el borrador existe en su tabla (precondición)', () => {
    expect(db.tables.inscription_drafts).toHaveLength(1)
    expect(db.tables.inscriptions).toHaveLength(0)
  })

  it('consolidado (principal, completo y suplemento) vacío', async () => {
    for (const type of ['principal', 'completo', 'supplement']) {
      const output = await exportConsolidated('evt-1', type)
      expect(output.athletes).toEqual([])
      expect(output.results).toEqual([])
      expect(output.teams).toEqual([])
      expect(JSON.stringify(output)).not.toContain(SECRET)
    }
  })

  it('tablero: received 0, athlete_count 0, club en "draft" (pendiente) y sin el contenido', async () => {
    const dashboard = await getDashboard('evt-1')
    const club = dashboard.clubs.find((item) => item.code === 5)
    expect(dashboard.counts).toMatchObject({ received: 0, athletes: 0, pending: 1 })
    expect(club).toMatchObject({ status: 'draft', athlete_count: 0, inscription_count: 0, submitted_at: null })
    expect(club.draft).toEqual({ athlete_count: 2, updated_at: expect.any(String), is_late: false })
    expect(dashboard.late).toEqual([])
    expect(JSON.stringify(dashboard)).not.toContain(SECRET)
  })

  it('event_clubs.status y tokens.used_at no cambian', async () => {
    expect(db.tables.event_clubs[0].status).toBe('invited')
    expect(db.tables.tokens.every((row) => !row.used_at)).toBe(true)
  })

  it('"Ver inscripciones" no lo ve', async () => {
    expect(await getClubInscriptions('evt-1', 5)).toEqual({ regular: null, late: null })
  })

  it('ClubStatus muestra "En borrador" y la tarjeta solo existencia, cantidad y fecha', async () => {
    expect(renderToStaticMarkup(<ClubStatus status="draft" />)).toContain('● En borrador')
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    const noop = () => {}
    const html = renderToStaticMarkup(<ClubLinkCard club={club} eventId="evt-1" emailing={false} url="" onCopy={noop} onOpenDetail={noop} onEmail={noop} onRevoke={noop} onToggle={noop} onRegeneratePin={noop} onRegenerateToken={noop} />)
    expect(html).toContain('Borrador sin enviar · 2 nadadores')
    expect(html).not.toContain(SECRET)
    expect(html).not.toContain('Ver inscripciones')
    expect(renderToStaticMarkup(<DraftStatus draft={{ athlete_count: 1, updated_at: new Date().toISOString(), is_late: true }} />)).toContain('Borrador de tardía sin enviar · 1 nadador ·')
    expect(renderToStaticMarkup(<DraftStatus draft={null} />)).toBe('')
  })

  it('con inscripción enviada el club es "received" y el borrador purgado ya no aparece', async () => {
    await submitInscription(payload(v3, 3, 'ENVIADO'))
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club).toMatchObject({ status: 'received', athlete_count: 3, draft: null })
  })

  it('un club que no participa no muestra borrador', async () => {
    db.tables.event_clubs[0].status = 'not_participating'
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club).toMatchObject({ status: 'not_participating', draft: null })
  })

  it('sin la tabla el tablero funciona igual (sin borradores)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    __setSupabaseClient({
      from(table) {
        if (table !== 'inscription_drafts') return db.from(table)
        const builder = { then: (resolve) => resolve({ data: null, error: { message: 'relation does not exist', code: '42P01' } }) }
        for (const method of ['select', 'eq']) builder[method] = () => builder
        return builder
      }
    })
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club).toMatchObject({ status: 'sent', draft: null })
  })
})

describe('purgas', () => {
  const pushDraft = (eventId) => db.tables.inscription_drafts.push({ event_id: eventId, club_code: 5, is_late: false, author_key: 'link', roster: [], athlete_count: 1, base_version: 0, rev: 1 })

  it('al archivar el evento se borran sus borradores (y solo los suyos)', async () => {
    pushDraft('evt-otro')
    await updateEventStatus('evt-1', 'closed')
    expect(db.tables.inscription_drafts).toHaveLength(2) // cerrar no purga
    await updateEventStatus('evt-1', 'archived')
    expect(db.tables.inscription_drafts.map((row) => row.event_id)).toEqual(['evt-otro'])
  })

  it(`cron: eventos cerrados o archivados hace más de ${DRAFT_RETENTION_DAYS} días`, async () => {
    const now = Date.parse('2026-12-31T12:00:00Z')
    const ago = (days) => new Date(now - days * DAY).toISOString()
    db.tables.events.push(
      { id: 'cerrado-viejo', status: 'closed', closed_at: ago(31) },
      { id: 'archivado-viejo', status: 'archived', closed_at: ago(90) },
      { id: 'cerrado-reciente', status: 'closed', closed_at: ago(29) },
      { id: 'tardias-viejo', status: 'accepting_late', closed_at: ago(60) },
      { id: 'cerrado-sin-fecha', status: 'closed', closed_at: null }
    )
    for (const id of ['cerrado-viejo', 'archivado-viejo', 'cerrado-reciente', 'tardias-viejo', 'cerrado-sin-fecha']) pushDraft(id)
    expect(await purgeStaleDrafts(db, { now })).toEqual({ events: 2 })
    expect(db.tables.inscription_drafts.map((row) => row.event_id).sort()).toEqual(['cerrado-reciente', 'cerrado-sin-fecha', 'evt-1', 'tardias-viejo'])
  })
})

describe('keep-alive sigue respondiendo aunque la purga falle', () => {
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
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://fake.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-fake'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fake'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.VITE_SUPABASE_ANON_KEY
  })

  it('purga ok', async () => {
    mocks.client = db
    const res = response()
    await keepAliveHandler({}, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ alive: true, drafts_purge: 'ok' })
  })

  it('la purga falla (error de la base o excepción): alive igual', async () => {
    for (const client of [{ from: () => ({ select: () => ({ in: () => ({ lt: async () => ({ data: null, error: { message: 'caída' } }) }) }) }) }, { from: () => { throw new Error('explota') } }]) {
      mocks.client = client
      const res = response()
      await keepAliveHandler({}, res)
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({ alive: true, drafts_purge: 'failed' })
    }
  })

  it('sin service role: se salta la purga', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = response()
    await keepAliveHandler({}, res)
    expect(res.body).toMatchObject({ alive: true, drafts_purge: 'skipped' })
  })
})
