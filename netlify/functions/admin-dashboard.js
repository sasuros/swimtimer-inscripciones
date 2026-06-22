import { isAdmin } from './_shared/auth.js'
import { json } from './_shared/http.js'
import { listJson } from './_shared/storage.js'
import { CLUBS, EVENT } from './_shared/config.js'

export default async request => {
  if (!isAdmin(request)) return json({ error: 'No autorizado' }, 401)
  try {
    const [tokens, inscriptions] = await Promise.all([listJson('tokens:'), listJson('inscriptions:')])
    const clubs = CLUBS.map(club => { const token = tokens.find(item => Number(item.club.code) === club.code); const inscription = inscriptions.find(item => Number(item.meta?.club_code) === club.code); return { ...club, status: inscription ? 'received' : token ? 'sent' : 'missing', athlete_count: inscription?.athletes?.length || 0, submitted_at: inscription?.submitted_at || null, token: token?.id || null, expires_at: token?.expires_at || null } })
    return json({ event: EVENT, clubs, counts: { total_clubs: clubs.length, received: clubs.filter(item => item.status === 'received').length, pending: clubs.filter(item => item.status !== 'received').length, athletes: clubs.reduce((sum, item) => sum + item.athlete_count, 0) } })
  } catch (error) { console.error(error); return json({ error: 'No se pudo cargar el dashboard' }, 500) }
}
