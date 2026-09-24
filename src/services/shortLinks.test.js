import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, generateEmailInvitations, generateTokens, getDashboard, regenerateClubToken, revokeMagicInvitation, submitInscription, validateToken, verifyAccessPin } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'
import { isShortId } from '../utils/shortId'
import { clubLinkText } from '../utils/messageTemplates'

afterEach(() => __setSupabaseClient(null))

// v1.17.0 — Enlaces cortos. Club 5, PIN sembrado '1234', correo club5@test.com.
async function setup() {
  const { db, token: v3Long } = await seed()
  await generateTokens('evt-1')
  const v2Row = () => db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === 5)
  return { db, v2Row, v2Long: v2Row().token_value, v3Long }
}
const unknownShort = 'Zz9Zz9Zz9Z'

describe('el corto valida como el largo (y pasa por el mismo PIN)', () => {
  it('generateTokens deja un short_id de 10 caracteres y el tablero lo usa', async () => {
    const { v2Row } = await setup()
    expect(isShortId(v2Row().short_id)).toBe(true)
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club.token).toBe(v2Row().short_id)
    expect(clubLinkText(club, `https://x.test/inscribir?t=${club.token}`)).toBe(`Club Cinco: https://x.test/inscribir?t=${v2Row().short_id} · PIN: 1234`)
  })

  it('validar el corto da exactamente lo mismo que el largo, sin PIN y con PIN', async () => {
    const { v2Row, v2Long } = await setup()
    await submitInscription(payload(v2Long, 2, 'PREVIO'))
    const short = v2Row().short_id
    for (const options of [undefined, { pin: '1234' }, { pin: '0000' }]) {
      expect(await validateToken(short, options)).toEqual(await validateToken(v2Long, options))
    }
    const basic = await validateToken(short)
    expect(basic).toMatchObject({ valid: true, requiresPin: true, pinVerified: false })
    expect(basic).not.toHaveProperty('inscription')
    expect((await validateToken(short, { pin: '1234' })).inscription.roster).toHaveLength(2)
  })

  it('verifyAccessPin y el envío con el corto: exigen PIN y guardan el token largo', async () => {
    const { db, v2Row, v2Long } = await setup()
    const short = v2Row().short_id
    await expect(verifyAccessPin(short, '1234')).resolves.toEqual({ valid: true })
    await expect(verifyAccessPin(short, '4321')).resolves.toEqual({ valid: false })
    await expect(submitInscription(payload(short, 1, 'X', ''))).rejects.toThrow('Código de acceso')
    await expect(submitInscription(payload(short, 3, 'CORTO'))).resolves.toMatchObject({ success: true })
    expect(db.tables.inscriptions[0].token_id).toBe(v2Long)
    expect(v2Row().used_at).toBeTruthy()
  })

  it('un corto inexistente es inválido en las tres funciones', async () => {
    await setup()
    await expect(validateToken(unknownShort)).resolves.toEqual({ valid: false })
    await expect(verifyAccessPin(unknownShort, '1234')).resolves.toEqual({ valid: false })
    await expect(submitInscription(payload(unknownShort, 1))).rejects.toThrow('El enlace no es válido')
  })

  it('un enlace largo viejo sigue válido cuando su fila ya tiene corto', async () => {
    const { v2Row, v2Long } = await setup()
    expect(v2Row().short_id).toBeTruthy()
    expect(await validateToken(v2Long)).toMatchObject({ valid: true, requiresPin: true, eventId: 'evt-1' })
    await expect(submitInscription(payload(v2Long, 1))).resolves.toMatchObject({ success: true })
  })
})

describe('sin ambigüedad entre corto y largo', () => {
  it('isShortId: solo 10 caracteres alfanuméricos; nunca un v2/v3 real ni un v1 del demo', async () => {
    const { v2Long, v3Long } = await setup()
    expect(v2Long.startsWith('eyJ')).toBe(true)
    expect(v3Long.startsWith('eyJ')).toBe(true)
    for (const value of [v2Long, v3Long, 'AKP-2026-token-v1', 'abc', 'abcdefghij1', 'abcde-ghij', '', null]) expect(isShortId(value)).toBe(false)
    expect(isShortId('Ab3xK9pQ2m')).toBe(true)
  })
})

describe('generación: se conserva al reactivar, se rota al regenerar, lazy en filas viejas', () => {
  it('lazy: una fila vieja sin short_id lo recibe al abrir el tablero y queda estable', async () => {
    const { v2Row } = await setup()
    delete v2Row().short_id
    const first = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5).token
    expect(isShortId(first)).toBe(true)
    expect(v2Row().short_id).toBe(first)
    expect((await getDashboard('evt-1')).clubs.find((item) => item.code === 5).token).toBe(first)
  })

  it('lazy no bloqueante: si falta la columna, el tablero sigue con el enlace largo', async () => {
    const { db, v2Row, v2Long } = await setup()
    delete v2Row().short_id
    __setSupabaseClient({
      from(table) {
        const builder = db.from(table)
        if (table === 'tokens') builder.update = () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: null, error: { code: '42703', message: 'column tokens.short_id does not exist' } }) }) }) })
        return builder
      }
    })
    const club = (await getDashboard('evt-1')).clubs.find((item) => item.code === 5)
    expect(club.token).toBe(v2Long)
  })

  it('reactivar (generateTokens) conserva el corto; "Crear enlace nuevo" lo rota', async () => {
    const { v2Row } = await setup()
    const original = v2Row().short_id
    await generateTokens('evt-1')
    expect(v2Row().short_id).toBe(original)

    const { token: rotated } = await regenerateClubToken('evt-1', 5)
    expect(isShortId(rotated)).toBe(true)
    expect(rotated).not.toBe(original)
    await expect(validateToken(original)).resolves.toEqual({ valid: false })
    expect(await validateToken(rotated)).toMatchObject({ valid: true, requiresPin: true })
  })

  it('choque con el índice único: reintenta con otro corto', async () => {
    const { db } = await setup()
    let calls = 0
    __setSupabaseClient({
      from(table) {
        const builder = db.from(table)
        if (table === 'tokens') {
          const original = builder.upsert
          builder.upsert = (...args) => {
            calls += 1
            return calls === 1 ? { then: (resolve) => resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "tokens_short_id_key"' } }) } : original(...args)
          }
        }
        return builder
      }
    })
    const { token } = await regenerateClubToken('evt-1', 5)
    expect(calls).toBe(2)
    expect(isShortId(token)).toBe(true)
  })
})

describe('v3 (correo) con su propio corto', () => {
  it('el corto del correo resuelve al v3: PIN, correo atado y revocación', async () => {
    const { db, v2Row } = await setup()
    const [invitation] = await generateEmailInvitations('evt-1', [5])
    const short = invitation.token
    expect(isShortId(short)).toBe(true)
    expect(short).not.toBe(v2Row().short_id)

    const basic = await validateToken(short)
    expect(basic).toMatchObject({ valid: true, requiresPin: true, pinVerified: false, authorizedEmail: 'club5@test.com' })
    expect(basic).not.toHaveProperty('inscription')
    expect((await validateToken(short, { pin: '1234' })).pinVerified).toBe(true)

    db.tables.event_clubs[0].email = 'otro@test.com' // el v3 sigue atado al correo
    await expect(validateToken(short, { pin: '1234' })).resolves.toEqual({ valid: false })
    db.tables.event_clubs[0].email = 'club5@test.com'

    await revokeMagicInvitation('evt-1', 5)
    await expect(validateToken(short)).resolves.toEqual({ valid: false })
  })

  it('reenviar el correo rota su corto (como el largo)', async () => {
    await setup()
    const [first] = await generateEmailInvitations('evt-1', [5])
    await new Promise((resolve) => setTimeout(resolve, 2)) // iat distinto
    const [second] = await generateEmailInvitations('evt-1', [5])
    expect(second.token).not.toBe(first.token)
    await expect(validateToken(first.token)).resolves.toEqual({ valid: false })
    expect((await validateToken(second.token)).valid).toBe(true)
  })
})
