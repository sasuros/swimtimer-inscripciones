export function generateClubPin(random = crypto.getRandomValues.bind(crypto)) {
  const values = new Uint32Array(1)
  random(values)
  return String(1000 + (values[0] % 9000))
}

export function normalizeClubPin(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4)
}

export function ensureClubPin(club) {
  const pin = normalizeClubPin(club?.pin)
  return { ...club, pin: pin.length === 4 ? pin : generateClubPin() }
}
