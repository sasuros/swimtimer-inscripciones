import { randomBytes } from 'node:crypto'
import { isAdmin } from './_shared/auth.js'
import { json } from './_shared/http.js'
import { listJson, setJson } from './_shared/storage.js'
import { CLUBS, EVENT } from './_shared/config.js'

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  if (!isAdmin(request)) return json({ error: 'No autorizado' }, 401)
  try {
    const existing = await listJson('tokens:')
    const expires = new Date(); expires.setDate(expires.getDate() + 60)
    const records = CLUBS.map(club => existing.find(item => Number(item.club.code) === club.code) || { id: `${String(club.name).slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${new Date().getFullYear()}-${randomBytes(4).toString('hex')}`, club, event: EVENT, used: false, created_at: new Date().toISOString(), expires_at: expires.toISOString() })
    await Promise.all(records.map(record => setJson(`tokens:${record.id}`, record)))
    await setJson('index:tokens', records.map(record => record.id))
    return json({ success: true, tokens: records })
  } catch (error) { console.error(error); return json({ error: 'No se pudieron generar los enlaces' }, 500) }
}
