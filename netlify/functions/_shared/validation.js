import { EVENT, EVENTS } from './config.js'
const TIME = /^(\d{1,2}:)?\d{1,2}\.\d{2}$/
function ageAt(birthDate) { const birth = new Date(`${birthDate}T12:00:00Z`); const ref = new Date(`${EVENT.reference_date}T12:00:00Z`); let age = ref.getUTCFullYear() - birth.getUTCFullYear(); if (ref.getUTCMonth() < birth.getUTCMonth() || (ref.getUTCMonth() === birth.getUTCMonth() && ref.getUTCDate() < birth.getUTCDate())) age--; return age }
export function validateSubmission(data, club) {
  if (!Array.isArray(data?.athletes) || !Array.isArray(data?.results) || !Array.isArray(data?.roster) || !data.roster.length) return 'La inscripción no contiene nadadores'
  if (data.athletes.length !== data.roster.length) return 'La cantidad de atletas no coincide con el roster'
  const ids = new Set(data.athletes.map(item => item.Ath_no))
  for (const athlete of data.athletes) {
    if (!athlete.Last_name || !athlete.First_name || !['F', 'M'].includes(athlete.Ath_Sex)) return 'Hay datos obligatorios de atletas incompletos'
    if (athlete.Team_no !== Number(club.code) || !Number.isInteger(athlete.Ath_no)) return 'La identificación del club o atleta no es válida'
    if (athlete.Ath_age !== ageAt(athlete.Birth_date) || athlete.Ath_age < 3 || athlete.Ath_age > 18) return 'La edad de un atleta no es válida para el evento'
  }
  for (const result of data.results) {
    const event = EVENTS[result.Event_ptr]
    const athlete = data.athletes.find(item => item.Ath_no === result.Ath_no)
    if (!ids.has(result.Ath_no) || !event || !TIME.test(result.ActualSeed_time || '')) return 'Hay una inscripción o tiempo inválido'
    if (!event.ages.some(([min, max]) => athlete.Ath_age >= min && athlete.Ath_age <= max)) return `${athlete.First_name} tiene ${athlete.Ath_age} años pero el evento seleccionado no corresponde a su categoría`
    if (result.ActualSeed_time !== result.ConvSeed_time || result.ActSeed_course !== 'S' || result.ConvSeed_course !== 'S') return 'El formato Meet Manager no es válido'
  }
  return ''
}
