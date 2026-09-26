import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setSupabaseClient, generateEmailInvitations, generateTokens, regenerateClubToken, revokeMagicInvitation, submitInscription, validateToken } from './supabaseStorage'
import { payload, seed } from './testSupport/fakeSupabase'
import { tokenKey } from './wizardSupabase.js'
import { createMagicToken } from '../utils/magicToken'
import { isShortId } from '../utils/shortId'
import { NEW_LINK_CONFIRM, NEW_LINK_HELP, RESEND_HELP } from '../utils/messageTemplates'
import { MAGIC_SIGNING_KEY } from '../config'

afterEach(() => {
  vi.restoreAllMocks()
  __setSupabaseClient(null)
})

// v1.20.2 — "Reenviar invitación" manda el mismo enlace del correo (v3). Solo se crea uno
// nuevo si no había, si cambió el correo del club o si la firma ya no valida.
// Club 5, PIN sembrado '1234', correo club5@test.com (el seed deja un v3 sin short_id).
const v3Row = (db, clubCode = 5) => db.tables.tokens.find((row) => row.token_type === 'v3' && row.club_code === clubCode)
const v2Row = (db, clubCode = 5) => db.tables.tokens.find((row) => row.token_type === 'v2' && row.club_code === clubCode)
const snapshot = (row) => ({ id: row.id, token_value: row.token_value, short_id: row.short_id, created_at: row.created_at })
const isValid = async (link) => (await validateToken(link, { pin: '1234' })).pinVerified === true

async function replaceV3(db, tokenValue) {
  Object.assign(v3Row(db), { id: await tokenKey(tokenValue), token_value: tokenValue, short_id: undefined })
}

describe('reenviar conserva el enlace del correo', () => {
  it('reenviar dos veces deja el mismo id, token largo y short_id; el primer correo sigue valiendo', async () => {
    const { db } = await seed()
    const [first] = await generateEmailInvitations('evt-1', [5])
    const before = snapshot(v3Row(db))
    expect(isShortId(first.token)).toBe(true)
    expect(first.token).toBe(before.short_id)

    await submitInscription(payload(before.token_value, 2, 'PRIMERO'))
    const usedAt = v3Row(db).used_at
    expect(usedAt).toBeTruthy()

    await new Promise((resolve) => setTimeout(resolve, 2)) // un token nuevo tendría otro iat
    const [second] = await generateEmailInvitations('evt-1', [5])
    const [third] = await generateEmailInvitations('evt-1', [5])
    expect(second.token).toBe(first.token)
    expect(third.token).toBe(first.token)
    expect(snapshot(v3Row(db))).toEqual(before)
    expect(v3Row(db).used_at).toBe(usedAt)
    expect(db.tables.tokens.filter((row) => row.token_type === 'v3')).toHaveLength(1)

    // El enlace del primer correo (corto y largo) sigue entrando y enviando con PIN.
    expect(await isValid(first.token)).toBe(true)
    expect(await isValid(before.token_value)).toBe(true)
    await expect(submitInscription(payload(first.token, 3, 'SEGUNDO'))).resolves.toMatchObject({ success: true })
  })

  it('"Enviar a todos": el club ya invitado conserva su enlace y el nuevo recibe el suyo', async () => {
    const { db } = await seed()
    db.tables.clubs.push({ code: 6, name: 'Club Seis', short_name: 'C6', abbreviation: 'SEI' })
    db.tables.event_clubs.push({ event_id: 'evt-1', club_code: 6, status: 'invited', contact_name: '', contact_whatsapp: '', email: 'club6@test.com', pin: '5678', invitation_sent_at: null, invitation_error: '' })
    const [invited] = await generateEmailInvitations('evt-1', [5])
    const before = snapshot(v3Row(db))

    const all = await generateEmailInvitations('evt-1')
    const byCode = new Map(all.map((item) => [Number(item.club.code), item.token]))
    expect(byCode.get(5)).toBe(invited.token)
    expect(snapshot(v3Row(db))).toEqual(before)
    expect(isShortId(byCode.get(6))).toBe(true)
    expect(byCode.get(6)).toBe(v3Row(db, 6).short_id)
    expect((await validateToken(byCode.get(6), { pin: '5678' })).pinVerified).toBe(true)
  })

  it('un v3 viejo sin short_id recibe uno y su enlace largo no cambia', async () => {
    const { db, token } = await seed()
    expect(v3Row(db).short_id).toBeUndefined()
    const [invitation] = await generateEmailInvitations('evt-1', [5])
    expect(v3Row(db).token_value).toBe(token)
    expect(isShortId(invitation.token)).toBe(true)
    expect(await isValid(token)).toBe(true)
    expect(await isValid(invitation.token)).toBe(true)
  })

  it('no hay vencimiento por iat: un v3 de hace años se reutiliza y el servidor lo acepta', async () => {
    const { db } = await seed()
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2020-01-01T00:00:00Z'))
    const old = await createMagicToken({ eventId: 'evt-1', clubCode: 5, email: 'club5@test.com' }, MAGIC_SIGNING_KEY)
    vi.restoreAllMocks()
    await replaceV3(db, old)

    const [invitation] = await generateEmailInvitations('evt-1', [5])
    expect(v3Row(db).token_value).toBe(old)
    expect(invitation.token).toBe(v3Row(db).short_id)
    expect(await isValid(old)).toBe(true)
  })
})

describe('cuándo sí se crea un enlace nuevo del correo', () => {
  it('si cambió el correo del club: enlace nuevo y el anterior deja de servir', async () => {
    const { db } = await seed()
    const [first] = await generateEmailInvitations('evt-1', [5])
    const before = snapshot(v3Row(db))

    db.tables.event_clubs[0].email = 'nuevo@test.com'
    const [second] = await generateEmailInvitations('evt-1', [5])
    expect(second.token).not.toBe(first.token)
    expect(v3Row(db).id).not.toBe(before.id)
    expect(await isValid(first.token)).toBe(false)
    expect(await isValid(before.token_value)).toBe(false)
    expect(await isValid(second.token)).toBe(true)
    expect((await validateToken(second.token)).authorizedEmail).toBe('nuevo@test.com')
  })

  it('si la firma no valida con la clave actual (clave cambiada): enlace nuevo', async () => {
    const { db } = await seed()
    const foreign = await createMagicToken({ eventId: 'evt-1', clubCode: 5, email: 'club5@test.com' }, 'otra-clave')
    await replaceV3(db, foreign)
    expect(await isValid(foreign)).toBe(false)

    const [invitation] = await generateEmailInvitations('evt-1', [5])
    expect(v3Row(db).token_value).not.toBe(foreign)
    expect(await isValid(invitation.token)).toBe(true)
  })

  it('"Revocar acceso" y luego "Enviar": enlace nuevo y el anterior deja de servir', async () => {
    const { db } = await seed()
    const [first] = await generateEmailInvitations('evt-1', [5])
    const before = snapshot(v3Row(db))
    await revokeMagicInvitation('evt-1', 5)
    await new Promise((resolve) => setTimeout(resolve, 2)) // iat distinto: otro token
    const [second] = await generateEmailInvitations('evt-1', [5])
    expect(second.token).not.toBe(first.token)
    expect(v3Row(db).token_value).not.toBe(before.token_value)
    expect(await isValid(first.token)).toBe(false)
    expect(await isValid(second.token)).toBe(true)
  })
})

describe('"Crear enlace nuevo" solo rota el enlace de WhatsApp y Copiar', () => {
  // El v2 largo es determinista (encodeDemoToken no lleva iat ni nonce): hoy solo rota el
  // corto. Pendiente fuera de v1.20.2; este test no fija el comportamiento del largo.
  it('rota el corto del v2 y deja el v3 del correo intacto y válido', async () => {
    const { db } = await seed()
    await generateTokens('evt-1')
    const [invitation] = await generateEmailInvitations('evt-1', [5])
    const v2Before = snapshot(v2Row(db))
    const v3Before = snapshot(v3Row(db))

    const { token: rotated } = await regenerateClubToken('evt-1', 5)
    expect(rotated).toBe(v2Row(db).short_id)
    expect(rotated).not.toBe(v2Before.short_id)
    await expect(validateToken(v2Before.short_id)).resolves.toEqual({ valid: false })
    expect(await isValid(rotated)).toBe(true)

    expect(snapshot(v3Row(db))).toEqual(v3Before)
    expect(await isValid(invitation.token)).toBe(true)
  })
})

describe('textos de ayuda de los botones del tablero', () => {
  it('Reenviar y Crear enlace nuevo dicen qué enlace cambia', () => {
    expect(RESEND_HELP).toBe('Reenvía el mismo enlace. El del correo anterior sigue funcionando.')
    expect(NEW_LINK_HELP).toBe('Cambia el enlace de WhatsApp y Copiar. No cambia el del correo.')
    expect(NEW_LINK_CONFIRM).toContain('El enlace del correo no cambia.')
    const source = readFileSync(new URL('../pages/AdminDashboard.jsx', import.meta.url), 'utf8')
    expect(source).toContain('title={club.invitation_sent_at ? RESEND_HELP : undefined}')
    expect(source).toContain('title={NEW_LINK_HELP}')
    expect(source).toContain('window.confirm(NEW_LINK_CONFIRM)')
  })
})
