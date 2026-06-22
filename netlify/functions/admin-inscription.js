import { isAdmin } from './_shared/auth.js'
import { json } from './_shared/http.js'
import { getJson } from './_shared/storage.js'

export default async request => {
  if (!isAdmin(request)) return json({ error: 'No autorizado' }, 401)
  const clubCode = new URL(request.url).searchParams.get('clubCode')
  const inscription = clubCode && await getJson(`inscriptions:${clubCode}`)
  return inscription ? json(inscription) : json({ error: 'Inscripción no encontrada' }, 404)
}
