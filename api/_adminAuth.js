// v1.16.0 — Vista previa del admin ("Abrir panel de inscripciones") sin tipear el PIN.
// APAGADA por defecto: solo se activa con WIZARD_ADMIN_PREVIEW=enabled, y eso solo
// debe hacerse con el registro de usuarios de Supabase deshabilitado (cualquier
// usuario autenticado cuenta como admin, igual que en send-invitation y en RLS).
// Vercel no publica como ruta los archivos de /api que empiezan con "_".
export const adminPreviewEnabled = () => (process.env.WIZARD_ADMIN_PREVIEW || '').trim() === 'enabled'

export function bearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
}

// true solo si la vista previa está habilitada Y el JWT es una sesión válida de Supabase.
export async function isAdminPreview(req, supabase) {
  if (!adminPreviewEnabled()) return false
  const accessToken = bearerToken(req)
  if (!accessToken || !supabase) return false
  try {
    const { data, error } = await supabase.auth.getUser(accessToken)
    return Boolean(!error && data?.user)
  } catch {
    return false
  }
}
