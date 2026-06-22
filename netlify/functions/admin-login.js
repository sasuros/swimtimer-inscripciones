import { timingSafeEqual } from 'node:crypto'
import { body, json } from './_shared/http.js'
import { createAdminToken } from './_shared/auth.js'

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const data = await body(request)
  const expected = process.env.ADMIN_PASSWORD || ''
  const supplied = data?.password || ''
  if (!expected) return json({ error: 'ADMIN_PASSWORD no está configurada' }, 503)
  const valid = supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  return valid ? json({ token: createAdminToken() }) : json({ error: 'Contraseña incorrecta' }, 401)
}
