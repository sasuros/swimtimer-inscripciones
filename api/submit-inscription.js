import { createClient } from '@supabase/supabase-js'
import { createSupabaseWizardStorage } from '../src/services/wizardSupabase.js'
import { isAdminPreview } from './_adminAuth.js'

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
    whatsapp: process.env.VITE_ALBERTO_WHATSAPP || '584120000000'
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo no permitido' })
  try {
    const { token, pin, athletes, results, roster, meta } = req.body || {}
    if (!token) return json(res, 400, { error: 'Token requerido' })
    if (!Array.isArray(athletes) || !Array.isArray(results)) return json(res, 400, { error: 'Inscripcion invalida' })
    const client = createServerClient()
    const admin = await isAdminPreview(req, client)
    return json(res, 200, await createServerWizardStorage(client).submitInscription({ token, pin, athletes, results, roster, meta }, { admin }))
  } catch (error) {
    const message = error.message || ''
    const status = /Código de acceso/.test(message) ? 401 : /enlace|cerradas|Supabase/.test(message) ? 400 : 500
    return json(res, status, { error: message || 'No se pudo enviar la inscripcion' })
  }
}
