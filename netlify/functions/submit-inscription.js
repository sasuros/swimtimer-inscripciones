import { body, json } from './_shared/http.js'
import { addToIndex, getJson, setJson } from './_shared/storage.js'
import { validateSubmission } from './_shared/validation.js'

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const data = await body(request)
  try {
    const token = data?.token && await getJson(`tokens:${data.token}`)
    if (!token || new Date(token.expires_at) < new Date()) return json({ success: false, error: 'El enlace no es válido o caducó' }, 401)
    const validationError = validateSubmission(data, token.club)
    if (validationError) return json({ success: false, error: validationError }, 400)
    const inscription = { meta: data.meta, athletes: data.athletes, results: data.results, roster: data.roster, submitted_at: new Date().toISOString(), token: data.token }
    await Promise.all([setJson(`inscriptions:${token.club.code}`, inscription), setJson(`tokens:${data.token}`, { ...token, used: true, submitted_at: inscription.submitted_at })])
    await addToIndex('index:inscriptions', String(token.club.code))
    return json({ success: true, summary: { athletes: data.athletes.length, inscriptions: data.results.length } })
  } catch (error) { console.error(error); return json({ success: false, error: 'No pudimos guardar la inscripción' }, 500) }
}
