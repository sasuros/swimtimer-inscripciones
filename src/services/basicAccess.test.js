import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, generateTokens } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'
import { BASIC_ACCESS_FIELDS, basicAccess, createSupabaseWizardStorage } from './wizardSupabase.js'
import { MAGIC_SIGNING_KEY } from '../config'

afterEach(() => __setSupabaseClient(null))

// v1.21.0 — Sin PIN solo viaja lo básico, por LISTA BLANCA: un campo nuevo del acceso
// completo (roster, borrador…) no se filtra aunque nadie se acuerde de quitarlo.
const BASIC_KEYS = [...BASIC_ACCESS_FIELDS, 'pinVerified'].sort()

describe('basicAccess es una lista blanca', () => {
  it('descarta cualquier campo que no esté en la lista, incluidos los futuros', () => {
    const full = {
      valid: true, requiresPin: true, backendAvailable: true, eventId: 'evt-1', event: { name: 'Copa' }, club: { code: 5 },
      authorizedEmail: 'club5@test.com', whatsapp: '584120000000', pinVerified: true,
      inscription: { roster: [{ id: 'N0' }] }, normal_inscription: { roster: [] }, already_submitted: true,
      draft: { roster: [{ id: 'BORRADOR' }], rev: 3 }, campoNuevo: 'secreto'
    }
    const basic = basicAccess(full)
    expect(Object.keys(basic).sort()).toEqual(BASIC_KEYS)
    expect(basic).toMatchObject({ requiresPin: true, pinVerified: false })
    expect(JSON.stringify(basic)).not.toMatch(/BORRADOR|secreto|N0/)
  })

  it('un campo ausente no aparece como undefined (v2 no trae authorizedEmail)', () => {
    expect(basicAccess({ valid: true, eventId: 'evt-1' })).toEqual({ valid: true, eventId: 'evt-1', requiresPin: true, pinVerified: false })
  })
})

describe('validateToken sin PIN (v2, v3 y corto) solo devuelve la lista blanca', () => {
  async function links() {
    const { db, token: v3 } = await seed()
    await generateTokens('evt-1')
    const v2Row = db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === 5)
    const wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
    await wizard.submitInscription(payload(v3, 2, 'ENVIADO'))
    return { db, wizard, all: { v3, v2: v2Row.token_value, corto: v2Row.short_id } }
  }

  it.each([['sin PIN', undefined], ['PIN incorrecto', '0000']])('%s', async (_name, pin) => {
    const { wizard, all } = await links()
    for (const link of Object.values(all)) {
      const access = await wizard.validateToken(link, { pin })
      expect(Object.keys(access).every((key) => BASIC_KEYS.includes(key))).toBe(true)
      expect(access.pinVerified).toBe(false)
      expect(JSON.stringify(access)).not.toContain('ENVIADO')
    }
  })

  it('con el evento cerrado tampoco (aun con PIN correcto)', async () => {
    const { db, wizard, all } = await links()
    db.tables.events[0].status = 'closed'
    const access = await wizard.validateToken(all.v3, { pin: '1234' })
    expect(Object.keys(access).every((key) => BASIC_KEYS.includes(key))).toBe(true)
    expect(JSON.stringify(access)).not.toContain('ENVIADO')
  })

  it('con PIN correcto sí llega el roster', async () => {
    const { wizard, all } = await links()
    expect((await wizard.validateToken(all.v3, { pin: '1234' })).inscription.roster).toHaveLength(2)
  })
})
