// v1.20.1 — Clave de firma de los enlaces v3. Falla cerrado: sin la variable (o vacía)
// el servidor responde 503 en vez de usar una clave por defecto conocida.
// El valor se usa tal cual (sin trim) para no alterar el de producción.
// Vercel no publica como ruta los archivos de /api que empiezan con "_".
export const SERVER_MISCONFIGURED = 'Servidor mal configurado'

export function misconfiguredError() {
  return Object.assign(new Error(SERVER_MISCONFIGURED), { status: 503 })
}

export function requireSigningSecret() {
  const secret = process.env.VITE_ADMIN_PASSWORD
  if (typeof secret !== 'string' || !secret.trim()) throw misconfiguredError()
  return secret
}
