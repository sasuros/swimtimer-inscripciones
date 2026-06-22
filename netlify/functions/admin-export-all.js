import { isAdmin } from './_shared/auth.js'
import { json } from './_shared/http.js'
import { listJson } from './_shared/storage.js'

export default async request => {
  if (!isAdmin(request)) return json({ error: 'No autorizado' }, 401)
  const inscriptions = await listJson('inscriptions:')
  return json({ meta: { system: 'SWIMTIMER Inscripciones by Scanleads', generated_at: new Date().toISOString(), club_count: inscriptions.length }, clubs: inscriptions })
}
