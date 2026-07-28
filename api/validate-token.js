import { createClient } from '@supabase/supabase-js'
import { createSupabaseWizardStorage } from '../src/services/wizardSupabase.js'

const json = (res, status, payload) => res.status(status).json(payload)

function createServerWizardStorage() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase no configurado')
  return createSupabaseWizardStorage({
    client: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }),
    adminPassword: process.env.VITE_ADMIN_PASSWORD || 'swimtimer2025',
    whatsapp: process.env.VITE_ALBERTO_WHATSAPP || '584120000000'
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo no permitido' })
  try {
    const { token } = req.body || {}
    if (!token) return json(res, 400, { error: 'Token requerido' })
    const storage = createServerWizardStorage()
    return json(res, 200, await storage.validateToken(token))
  } catch (error) {
    return json(res, 500, { error: error.message || 'No se pudo validar el token' })
  }
}
