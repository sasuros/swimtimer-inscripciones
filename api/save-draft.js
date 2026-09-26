import { createClient } from '@supabase/supabase-js'
import { createSupabaseWizardStorage } from '../src/services/wizardSupabase.js'
import { clientIpKey } from './_clientIp.js'
import { requireSigningSecret } from './_signingSecret.js'

// v1.21.0 — Guarda el borrador del entrenador (tabla inscription_drafts). Exige PIN siempre:
// la vista previa del admin no guarda borradores. El cliente trata cualquier error como
// "Guardado en este dispositivo": nunca bloquea la inscripción.
const json = (res, status, payload) => res.status(status).json(payload)

function createServerWizardStorage() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceRoleKey) throw Object.assign(new Error('Supabase no configurado'), { status: 503 })
  return createSupabaseWizardStorage({
    client: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }),
    adminPassword: requireSigningSecret(),
    whatsapp: process.env.VITE_ALBERTO_WHATSAPP || ''
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo no permitido' })
  try {
    const { token, pin, roster, base_version, expected_rev } = req.body || {}
    if (!token) return json(res, 400, { error: 'Token requerido' })
    return json(res, 200, await createServerWizardStorage().saveDraft({ token, pin, roster, base_version, expected_rev }, { ip: clientIpKey(req) }))
  } catch (error) {
    if (error.status === 429) return json(res, 429, { error: error.message, retryAfter: error.retryAfter })
    if (error.status === 409) return json(res, 409, { error: error.message, ...error.details, ...(error.closed ? { closed: true } : {}) })
    if ([400, 401, 413, 503].includes(error.status)) return json(res, error.status, { error: error.message })
    return json(res, 500, { error: error.message || 'No se pudo guardar el borrador' })
  }
}
