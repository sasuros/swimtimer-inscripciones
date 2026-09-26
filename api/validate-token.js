import { createClient } from '@supabase/supabase-js'
import { createSupabaseWizardStorage } from '../src/services/wizardSupabase.js'
import { isAdminPreview } from './_adminAuth.js'
import { clientIpKey } from './_clientIp.js'

const json = (res, status, payload) => res.status(status).json(payload)

function createServerClient() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase no configurado')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function createServerWizardStorage(client) {
  return createSupabaseWizardStorage({
    client,
    adminPassword: process.env.VITE_ADMIN_PASSWORD || 'swimtimer2025',
    whatsapp: process.env.VITE_ALBERTO_WHATSAPP || ''
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo no permitido' })
  try {
    const { token, pin } = req.body || {}
    if (!token) return json(res, 400, { error: 'Token requerido' })
    const client = createServerClient()
    const admin = await isAdminPreview(req, client)
    return json(res, 200, await createServerWizardStorage(client).validateToken(token, { pin, admin, ip: clientIpKey(req) }))
  } catch (error) {
    return json(res, 500, { error: error.message || 'No se pudo validar el token' })
  }
}
