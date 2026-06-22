import { createHmac, timingSafeEqual } from 'node:crypto'

const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''
const sign = value => createHmac('sha256', secret()).update(value).digest('base64url')
export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}
export function isAdmin(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !secret()) return false
  const expected = sign(payload)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
  try { const data = JSON.parse(Buffer.from(payload, 'base64url')); return data.role === 'admin' && data.exp > Date.now() } catch { return false }
}
