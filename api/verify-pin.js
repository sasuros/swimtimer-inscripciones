import { createClient } from '@supabase/supabase-js'
import { createSupabaseWizardStorage } from '../src/services/wizardSupabase.js'
import { clientIpKey } from './_clientIp.js'
import { requireSigningSecret } from './_signingSecret.js'

const json = (res, status, payload) => res.status(status).json(payload)

function createServerWizardStorage() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase no configurado')
  return createSupabaseWizardStorage({
    client: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }),
    adminPassword: requireSigningSecret(),
    whatsapp: process.env.VITE_ALBERTO_WHATSAPP || ''
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo no permitido' })
  try {
    const { token, pin } = req.body || {}
    if (!token || !pin) return json(res, 400, { error: 'Token y PIN requeridos' })
    const storage = createServerWizardStorage()
    return json(res, 200, await storage.verifyAccessPin(token, pin, { ip: clientIpKey(req) }))
  } catch (error) {
    if (error.status === 503) return json(res, 503, { error: error.message })
    if (error.status === 429) return json(res, 429, { error: error.message, retryAfter: error.retryAfter })
    return json(res, 500, { error: error.message || 'No se pudo verificar el PIN' })
  }
}
