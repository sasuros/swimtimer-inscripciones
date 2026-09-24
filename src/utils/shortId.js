// v1.17.0 — Enlaces cortos: /inscribir?t=<10 caracteres base62>.
// Es solo un alias de URL de una fila de `tokens`: el servidor lo traduce al token
// largo y a partir de ahí todo sigue igual (PIN incluido).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export const SHORT_ID_LENGTH = 10

// ~59.5 bits de azar. Descarta bytes >= 248 (4 × 62) para no sesgar la distribución.
export function generateShortId(random = (bytes) => crypto.getRandomValues(bytes)) {
  let id = ''
  while (id.length < SHORT_ID_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < 248 && id.length < SHORT_ID_LENGTH) id += ALPHABET[byte % 62]
    }
  }
  return id
}

// Sin ambigüedad: los tokens largos (v2/v3) son base64url de un JSON ("eyJ…", 180+
// caracteres) y los v1 del demo llevan guiones.
export const isShortId = (value) => typeof value === 'string' && /^[A-Za-z0-9]{10}$/.test(value)
