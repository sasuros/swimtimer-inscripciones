import { afterEach, describe, expect, it } from 'vitest'
import { __setSupabaseClient, generateTokens } from './supabaseStorage'
import { createFakeSupabase, payload } from './testSupport/fakeSupabase'
import { createSupabaseWizardStorage } from './wizardSupabase.js'
import { decodeDemoToken } from '../utils/demoToken'
import { teamIdentity } from '../utils/teamUtils'
import { MAGIC_SIGNING_KEY } from '../config'

afterEach(() => __setSupabaseClient(null))

// v1.16.0 — Falsificación del token v2 ("Copiar enlace"): base64 sin firma y
// determinístico. Un entrenador del club A reescribe su propio enlace con los datos
// del club B (código chico + nombre público + abreviatura/nombre corto que
// teamIdentity deriva igual para cualquiera) y obtiene el enlace real de B.
const toBase64Url = (text) => Buffer.from(text, 'utf8').toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

async function scenario() {
  const db = createFakeSupabase()
  db.tables.events.push({ id: 'evt-1', name: 'Copa Test', date_start: '2026-10-01', date_end: null, venue: 'Sede', reference_date: '2026-12-31', deadline: null, course: 'S', status: 'active', organizer_whatsapp: '584120000000', imported_from: {}, created_at: '2026-09-01T00:00:00Z' })
  db.tables.event_events.push({ event_id: 'evt-1', event_ptr: 1, distance: 50, style: 'Libre', age_lo: 9, age_hi: 12, sex: 'F', active: true })
  // Clubes sin short_name/abbreviation explícitos: se derivan con teamIdentity (regla pública).
  db.tables.clubs.push({ code: 5, name: 'Club Atacante', short_name: '', abbreviation: '' }, { code: 7, name: 'Club Victima', short_name: '', abbreviation: '' })
  for (const [code, pin] of [[5, '1111'], [7, '7777']]) db.tables.event_clubs.push({ event_id: 'evt-1', club_code: code, status: 'invited', contact_name: '', contact_whatsapp: '', email: '', pin, invitation_sent_at: null, invitation_error: '' })
  __setSupabaseClient(db)
  await generateTokens('evt-1') // enlaces v2 reales, como "Copiar enlace"

  const wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  const tokenOf = (code) => db.tables.tokens.find((row) => row.club_code === code && row.token_type === 'v2').token_value
  // La víctima ya envió su roster (datos ficticios).
  await wizard.submitInscription(payload(tokenOf(7), 2, 'VICTIMA', '7777'))

  // El atacante solo tiene SU enlace y datos públicos del club B.
  const own = decodeDemoToken(tokenOf(5))
  const victim = teamIdentity({ code: 7, name: 'Club Victima' })
  const forged = toBase64Url(JSON.stringify({ ...own, c: 7, cn: victim.name, ca: victim.abbreviation, cs: victim.short_name }))
  return { db, wizard, forged, victimToken: tokenOf(7) }
}

describe('v2 falsificable: el enlace de otro club no puede dar acceso sin PIN', () => {
  it('(precondición) el token forjado es idéntico al enlace real del club B', async () => {
    const { forged, victimToken } = await scenario()
    expect(forged).toBe(victimToken)
  })

  it('validar el enlace forjado exige PIN y NO expone el roster de B antes del PIN', async () => {
    const { wizard, forged } = await scenario()
    const access = await wizard.validateToken(forged)
    expect(access.club?.code).toBe(7)
    expect({ requiresPin: access.requiresPin, roster: access.inscription?.roster ?? null }).toEqual({ requiresPin: true, roster: null })
  })

  it('enviar con el enlace forjado sin PIN se rechaza y el roster de B queda intacto', async () => {
    const { db, wizard, forged } = await scenario()
    await expect(wizard.submitInscription(payload(forged, 1, 'ATACANTE', ''))).rejects.toThrow('Código de acceso')
    const rowB = db.tables.inscriptions.find((row) => row.club_code === 7)
    expect(rowB.roster.map((athlete) => athlete.lastName)).toEqual(['VICTIMA0', 'VICTIMA1'])
  })
})
