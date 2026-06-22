import clubs from '../data/clubs.json'
import eventData from '../data/events.json'
import { DEMO_ADMIN_PASSWORD, DEMO_WHATSAPP, STORAGE_KEYS } from '../config'

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const tokenPrefix = name => name.slice(0, 3).toUpperCase().normalize('NFD').replace(/[^A-Z]/g, 'X')

export function demoLogin(password) {
  if (password !== DEMO_ADMIN_PASSWORD) throw new Error('Contraseña incorrecta')
  return { token: `demo-admin-${Date.now()}` }
}

export function demoGenerateTokens() {
  const current = read(STORAGE_KEYS.tokens, [])
  const expires = new Date(); expires.setDate(expires.getDate() + 60)
  const tokens = clubs.map(club => current.find(item => Number(item.club.code) === Number(club.code)) || {
    id: `${tokenPrefix(club.name)}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8)}`,
    club,
    event: eventData.event,
    used: false,
    created_at: new Date().toISOString(),
    expires_at: expires.toISOString()
  })
  write(STORAGE_KEYS.tokens, tokens)
  return { success: true, tokens }
}

export function demoValidateToken(token) {
  const record = read(STORAGE_KEYS.tokens, []).find(item => item.id === token)
  if (!record || new Date(record.expires_at) < new Date()) return { valid: false }
  const inscription = read(STORAGE_KEYS.inscriptions, {})[record.club.code] || null
  return { valid: true, event: record.event, club: record.club, already_submitted: Boolean(inscription), inscription, whatsapp: DEMO_WHATSAPP }
}

export function demoSubmitInscription(payload) {
  const access = demoValidateToken(payload.token)
  if (!access.valid) throw new Error('El enlace no es válido o caducó')
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const inscription = { meta: payload.meta, athletes: payload.athletes, results: payload.results, roster: payload.roster, submitted_at: new Date().toISOString(), token: payload.token }
  inscriptions[access.club.code] = inscription
  write(STORAGE_KEYS.inscriptions, inscriptions)
  const tokens = read(STORAGE_KEYS.tokens, []).map(item => item.id === payload.token ? { ...item, used: true, submitted_at: inscription.submitted_at } : item)
  write(STORAGE_KEYS.tokens, tokens)
  return { success: true, summary: { athletes: payload.athletes.length, inscriptions: payload.results.length } }
}

export function demoDashboard() {
  const tokens = read(STORAGE_KEYS.tokens, [])
  const inscriptions = read(STORAGE_KEYS.inscriptions, {})
  const clubRows = clubs.map(club => {
    const token = tokens.find(item => Number(item.club.code) === Number(club.code))
    const inscription = inscriptions[club.code]
    return { ...club, status: inscription ? 'received' : token ? 'sent' : 'missing', athlete_count: inscription?.athletes?.length || 0, submitted_at: inscription?.submitted_at || null, token: token?.id || null, expires_at: token?.expires_at || null }
  })
  return { event: eventData.event, clubs: clubRows, counts: { total_clubs: clubRows.length, received: clubRows.filter(item => item.status === 'received').length, pending: clubRows.filter(item => item.status !== 'received').length, athletes: clubRows.reduce((sum, item) => sum + item.athlete_count, 0) } }
}

export function demoGetInscription(clubCode) {
  const inscription = read(STORAGE_KEYS.inscriptions, {})[clubCode]
  if (!inscription) throw new Error('Inscripción no encontrada')
  return inscription
}

export function demoExportAll() {
  const clubsData = Object.values(read(STORAGE_KEYS.inscriptions, {}))
  return { meta: { system: 'SWIMTIMER Inscripciones by Scanleads', generated_at: new Date().toISOString(), club_count: clubsData.length }, clubs: clubsData }
}
