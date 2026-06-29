const KNOWN_TEAMS = {
  2: ['AKP', 'AKP'], 3: ['BERROTERÁN', 'BRR'], 4: ['MULTISPORT', 'CMS'], 5: ['CNC', 'CNC'],
  6: ['MANTARRAYAS', 'MNT'], 7: ['LA TRINIDAD', 'TRN'], 8: ['PAN DE AZÚCAR', 'PDA'],
  9: ['SANTA PAULA', 'STP'], 10: ['TIBURONES', 'TBR'], 11: ['LIBRE 1', 'LB1'],
  12: ['LIBRE 2', 'LB2'], 13: ['DEL CAMINO', 'NSC']
}

export function teamIdentity(team) {
  const known = KNOWN_TEAMS[Number(team.code)]
  const name = String(team.name || '').trim()
  const firstWord = name.split(/\s+/)[0]?.toLocaleUpperCase('es') || `CLUB ${team.code}`
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const consonants = normalized.replace(/[^A-Z0-9]/g, '').replace(/[AEIOU]/g, '')
  const fallbackAbbr = (consonants.slice(0, 3) || normalized.replace(/[^A-Z0-9]/g, '').slice(0, 3) || `C${team.code}`).slice(0, 5)
  return {
    ...team,
    code: Number(team.code),
    name,
    short_name: String(team.short_name || known?.[0] || firstWord).slice(0, 16),
    abbreviation: String(team.abbreviation || known?.[1] || fallbackAbbr).slice(0, 5),
    contact_name: team.contact_name || '', contact_whatsapp: team.contact_whatsapp || '', contact_email: team.contact_email || ''
  }
}
