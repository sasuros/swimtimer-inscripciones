// v1.16.1 — Clave de IP para el límite de intentos del PIN.
// Verificado en un preview: Vercel SOBRESCRIBE x-forwarded-for / x-real-ip con la IP
// real (lo que mande el cliente se descarta). req.socket siempre es 127.0.0.1.
// IPv6 se agrupa por /64: un solo cliente suele tener todo ese bloque.
// Vercel no publica como ruta los archivos de /api que empiezan con "_".
export function ipKeyFrom(raw) {
  const ip = String(raw || '').split(',')[0].trim().replace(/^\[|\]$/g, '').split('%')[0]
  if (!ip) return 'unknown'
  if (!ip.includes(':')) return ip
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) return mapped[1]
  const [head, tail] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups.slice(0, 4).map((group) => (parseInt(group, 16) || 0).toString(16)).join(':')}::/64`
}

export function clientIpKey(req) {
  const headers = req.headers || {}
  return ipKeyFrom(headers['x-forwarded-for'] || headers['x-real-ip'])
}
