const EVENT_FIELDS = ['event_ptr', 'distance', 'style', 'age_lo', 'age_hi', 'sex', 'active']

const bytesToBase64 = bytes => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const base64ToBytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0))

export function compactEvents(events = []) {
  return events.map(event => [
    event.event_ptr,
    event.distance,
    event.style,
    event.age_lo,
    event.age_hi,
    event.sex,
    event.active ? 1 : 0
  ])
}

export function expandEvents(events = []) {
  return events.map(values => Object.fromEntries(EVENT_FIELDS.map((field, index) => [
    field,
    field === 'active' ? Boolean(values[index]) : values[index]
  ])))
}

export function encodeDemoToken(event, club) {
  const tokenData = {
    v: 2,
    e: event.id,
    en: event.name,
    c: Number(club.code),
    cn: club.name,
    ca: club.abbreviation || '',
    cs: club.short_name || '',
    d: event.date_start,
    ve: event.venue || '',
    rd: event.reference_date || event.date_start,
    wh: event.organizer_whatsapp || '',
    ev: compactEvents(event.events),
    dl: event.deadline || null,
    st: event.status
  }
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(tokenData)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeDemoToken(token) {
  try {
    const normalized = token.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const data = JSON.parse(new TextDecoder().decode(base64ToBytes(padded)))
    if (data.v !== 2 || !data.e || !data.c || !data.en || !Array.isArray(data.ev)) return null
    return data
  } catch {
    return null
  }
}

export function accessFromDemoToken(data) {
  return {
    valid: true,
    eventId: data.e,
    event: {
      id: data.e,
      name: data.en,
      date: data.d,
      date_start: data.d,
      venue: data.ve || '',
      reference_date: data.rd || data.d,
      deadline: data.dl || null,
      status: data.st,
      organizer_whatsapp: data.wh || '',
      events: expandEvents(data.ev)
    },
    club: {
      code: Number(data.c),
      name: data.cn,
      abbreviation: data.ca || '',
      short_name: data.cs || data.cn
    },
    whatsapp: data.wh || ''
  }
}
