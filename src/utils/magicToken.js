const toBase64Url = bytes => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const fromBase64Url = value => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function signature(value, password) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

export async function createMagicToken({ eventId, clubCode, email }, password) {
  const data = { v: 3, e: eventId, c: Number(clubCode), em: String(email).trim().toLowerCase(), iat: Date.now() }
  const sig = await signature(JSON.stringify(data), password)
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ ...data, sig })))
}

export function decodeMagicToken(token) {
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(token)))
    return data.v === 3 && data.e && data.c && data.em && data.sig ? data : null
  } catch {
    return null
  }
}

export async function verifyMagicToken(token, password) {
  const decoded = decodeMagicToken(token)
  if (!decoded) return null
  const { sig, ...data } = decoded
  const expected = await signature(JSON.stringify(data), password)
  if (sig.length !== expected.length) return null
  let difference = 0
  for (let index = 0; index < sig.length; index += 1) difference |= sig.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0 ? decoded : null
}
