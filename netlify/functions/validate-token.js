import { body, json } from './_shared/http.js'
import { getJson } from './_shared/storage.js'

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const data = await body(request)
  if (!data?.token) return json({ valid: false }, 400)
  try {
    const record = await getJson(`tokens:${data.token}`)
    if (!record || new Date(record.expires_at) < new Date()) return json({ valid: false })
    const inscription = await getJson(`inscriptions:${record.club.code}`)
    return json({ valid: true, event: record.event, club: record.club, already_submitted: Boolean(inscription), inscription, whatsapp: process.env.ALBERTO_WHATSAPP || '' })
  } catch (error) { console.error(error); return json({ valid: false, error: 'No se pudo validar el enlace' }, 500) }
}
