// v1.16.1 — Límite de intentos de PIN por (IP + token canónico). Nunca por club:
// un atacante desde una IP solo se frena a sí mismo en ese enlace.
// Tabla pin_attempts (migration_pin_rate_limit.sql): una fila por intento, solo inserts,
// así el conteo es atómico sin RPC (una ráfaga en paralelo se pasa por pocos intentos).
export const PIN_MAX_ATTEMPTS = 10
export const PIN_WINDOW_MS = 15 * 60 * 1000

export class RateLimitError extends Error {
  constructor(retryAfter) {
    super(`Demasiados intentos. Espera ${Math.max(1, Math.ceil(retryAfter / 60))} minutos e inténtalo de nuevo.`)
    this.name = 'RateLimitError'
    this.status = 429
    this.retryAfter = retryAfter
  }
}

// Registra el intento y cuenta los del par dentro de la ventana. Solo un conteo por
// encima del umbral rechaza: ante cualquier error de la base FALLA ABIERTO (deja pasar
// con un warning) para no bloquear nunca una inscripción por un problema nuestro.
export async function checkPinRateLimit(client, ipKey, tokenKey, { now = Date.now() } = {}) {
  try {
    const since = new Date(now - PIN_WINDOW_MS).toISOString()
    const pair = (query) => query.eq('ip_key', ipKey).eq('token_key', tokenKey)
    const pruned = await pair(client.from('pin_attempts').delete()).lt('created_at', since)
    if (pruned.error) throw pruned.error
    const inserted = await client.from('pin_attempts').insert({ ip_key: ipKey, token_key: tokenKey, created_at: new Date(now).toISOString() })
    if (inserted.error) throw inserted.error
    const recent = await pair(client.from('pin_attempts').select('created_at')).gte('created_at', since)
    if (recent.error) throw recent.error
    const attempts = recent.data || []
    if (attempts.length <= PIN_MAX_ATTEMPTS) return { limited: false }
    const oldest = Math.min(...attempts.map((row) => Date.parse(row.created_at)))
    return { limited: true, retryAfter: Math.max(1, Math.ceil((oldest + PIN_WINDOW_MS - now) / 1000)) }
  } catch (error) {
    console.warn('[pin-rate-limit] sin control de intentos (falla abierto):', error?.message || error)
    return { limited: false }
  }
}

// Un PIN correcto resetea el contador del par. Best-effort: si falla, solo avisa.
export async function clearPinRateLimit(client, ipKey, tokenKey) {
  try {
    const result = await client.from('pin_attempts').delete().eq('ip_key', ipKey).eq('token_key', tokenKey)
    if (result.error) throw result.error
  } catch (error) {
    console.warn('[pin-rate-limit] no se pudo resetear el contador:', error?.message || error)
  }
}

// v1.21.0 — Solo lectura: ¿el par ya está bloqueado? No registra ningún intento. Lo usa el
// guardado del borrador para que un PIN correcto no consuma cupo, sin abrir un atajo para
// adivinar el PIN: con el par bloqueado se rechaza aunque el PIN sea correcto, igual que
// verify-pin (el intento siguiente sería el número PIN_MAX_ATTEMPTS + 1). Falla abierto.
export async function pinRateLimitStatus(client, ipKey, tokenKey, { now = Date.now() } = {}) {
  try {
    const since = new Date(now - PIN_WINDOW_MS).toISOString()
    const recent = await client.from('pin_attempts').select('created_at').eq('ip_key', ipKey).eq('token_key', tokenKey).gte('created_at', since)
    if (recent.error) throw recent.error
    const attempts = recent.data || []
    if (attempts.length < PIN_MAX_ATTEMPTS) return { limited: false }
    const oldest = Math.min(...attempts.map((row) => Date.parse(row.created_at)))
    return { limited: true, retryAfter: Math.max(1, Math.ceil((oldest + PIN_WINDOW_MS - now) / 1000)) }
  } catch (error) {
    console.warn('[pin-rate-limit] sin control de intentos (falla abierto):', error?.message || error)
    return { limited: false }
  }
}
