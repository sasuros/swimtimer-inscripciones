import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, generateTokens } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'
import { createSupabaseWizardStorage } from './wizardSupabase.js'
import { DEMO_ADMIN_PASSWORD } from '../config'

afterEach(() => __setSupabaseClient(null))

// v1.16.0 — PIN exigido en el servidor para v2 y v3. Club 5, PIN sembrado '1234'.
async function setup() {
  const { db, token: v3 } = await seed()
  await generateTokens('evt-1') // enlace v2 largo, como los ya distribuidos
  const v2 = db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === 5).token_value
  const wizard = createSupabaseWizardStorage({ client: db, adminPassword: DEMO_ADMIN_PASSWORD })
  await wizard.submitInscription(payload(v2, 2, 'PREVIO')) // ya hay un roster guardado
  return { db, wizard, v2, v3 }
}
const DATA_KEYS = ['inscription', 'normal_inscription', 'already_submitted']

describe('v2 legítimo: sigue validando, ahora pidiendo PIN', () => {
  it('sin PIN: válido, requiresPin, y solo lo básico (sin roster ni "ya envió")', async () => {
    const { wizard, v2 } = await setup()
    const access = await wizard.validateToken(v2)
    expect(access).toMatchObject({ valid: true, requiresPin: true, pinVerified: false, eventId: 'evt-1', club: { code: 5 } })
    for (const key of DATA_KEYS) expect(access).not.toHaveProperty(key)
    expect(access.club).not.toHaveProperty('pin')
  })

  it('con PIN correcto llega el roster; con PIN incorrecto, solo lo básico', async () => {
    const { wizard, v2 } = await setup()
    const ok = await wizard.validateToken(v2, { pin: '1234' })
    expect(ok).toMatchObject({ valid: true, pinVerified: true, already_submitted: true })
    expect(ok.inscription.roster.map((athlete) => athlete.lastName)).toEqual(['PREVIO0', 'PREVIO1'])
    const wrong = await wizard.validateToken(v2, { pin: '9999' })
    expect(wrong.pinVerified).toBe(false)
    for (const key of DATA_KEYS) expect(wrong).not.toHaveProperty(key)
  })

  it('verifyAccessPin acepta v2 contra event_clubs.pin', async () => {
    const { wizard, v2 } = await setup()
    await expect(wizard.verifyAccessPin(v2, '1234')).resolves.toEqual({ valid: true })
    await expect(wizard.verifyAccessPin(v2, '0000')).resolves.toEqual({ valid: false })
    await expect(wizard.verifyAccessPin(v2, '12a4')).resolves.toEqual({ valid: false })
    await expect(wizard.verifyAccessPin('token-inexistente', '1234')).resolves.toEqual({ valid: false })
  })
})

describe('v3: el PIN sigue igual y ya no se filtra el roster antes del PIN', () => {
  it('sin PIN no expone el roster; con PIN sí; verifyAccessPin sigue funcionando', async () => {
    const { wizard, v3 } = await setup()
    const basic = await wizard.validateToken(v3)
    expect(basic).toMatchObject({ valid: true, requiresPin: true, pinVerified: false })
    for (const key of DATA_KEYS) expect(basic).not.toHaveProperty(key)
    expect((await wizard.validateToken(v3, { pin: '1234' })).inscription.roster).toHaveLength(2)
    await expect(wizard.verifyAccessPin(v3, '1234')).resolves.toEqual({ valid: true })
    await expect(wizard.verifyAccessPin(v3, '4321')).resolves.toEqual({ valid: false })
  })
})

describe('enviar exige PIN en el servidor', () => {
  it.each(['v2', 'v3'])('%s: sin PIN o con PIN incorrecto se rechaza y no pisa nada', async (type) => {
    const { db, wizard, ...tokens } = await setup()
    await expect(wizard.submitInscription(payload(tokens[type], 1, 'X', ''))).rejects.toThrow('Código de acceso')
    await expect(wizard.submitInscription(payload(tokens[type], 1, 'X', '0000'))).rejects.toThrow('Código de acceso')
    expect(db.tables.inscriptions[0].roster.map((athlete) => athlete.lastName)).toEqual(['PREVIO0', 'PREVIO1'])
  })

  it('con PIN correcto envía; como admin (vista previa habilitada) envía sin PIN', async () => {
    const { db, wizard, v2 } = await setup()
    await expect(wizard.submitInscription(payload(v2, 3, 'NUEVO', '1234'))).resolves.toMatchObject({ success: true })
    await expect(wizard.submitInscription(payload(v2, 1, 'ADMIN', ''), { admin: true })).resolves.toMatchObject({ success: true })
    expect(db.tables.inscriptions[0].roster.map((athlete) => athlete.lastName)).toEqual(['ADMIN0'])
  })

  it('el PIN no se guarda en la inscripción', async () => {
    const { db } = await setup()
    expect(JSON.stringify(db.tables.inscriptions)).not.toContain('"pin"')
  })
})
