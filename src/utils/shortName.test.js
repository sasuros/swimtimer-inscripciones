import { describe, expect, it } from 'vitest'
import { shortenAthlete, shortFirstName, shortLastName } from './shortName'

describe('shortLastName', () => {
  it.each([
    ['Rondón Salcedo', 'Rondón'],
    ['De la Cruz Pérez', 'De la Cruz'],
    ['Del Valle Rodríguez', 'Del Valle'],
    ['DE LA CRUZ PEREZ', 'DE LA CRUZ'],
    ['Pérez-Gómez', 'Pérez-Gómez'],
    ['Pérez-Gómez Díaz', 'Pérez-Gómez'],
    ['San Martín López', 'San Martín'],
    ['Santa Cruz', 'Santa Cruz'],
    ['Suros', 'Suros'],
    ['  Rondón    Salcedo ', 'Rondón'],
    ['De', 'De']
  ])('%s → %s', (input, expected) => expect(shortLastName(input)).toBe(expected))

  it('devuelve vacío sin valor', () => {
    expect(shortLastName('')).toBe('')
    expect(shortLastName('   ')).toBe('')
    expect(shortLastName(null)).toBe('')
    expect(shortLastName(undefined)).toBe('')
  })
})

describe('shortFirstName', () => {
  it.each([
    ['Tomás Elías', 'Tomás E.'],
    ['TOMÁS ELÍAS', 'TOMÁS E.'],
    ['Ana María', 'Ana M.'],
    ['María de los Ángeles', 'María Á.'],
    ['Ana', 'Ana'],
    ['  Ana    María  ', 'Ana M.'],
    ['María de', 'María']
  ])('%s → %s', (input, expected) => expect(shortFirstName(input)).toBe(expected))

  it('devuelve vacío sin valor', () => {
    expect(shortFirstName('')).toBe('')
    expect(shortFirstName(null)).toBe('')
    expect(shortFirstName(undefined)).toBe('')
  })
})

describe('shortenAthlete', () => {
  it('recorta nombre y apellido sin tocar el resto ni el original', () => {
    const athlete = { Ath_no: 5001, Last_name: 'De la Cruz Pérez', First_name: 'Ana María', Ath_age: 12 }
    expect(shortenAthlete(athlete)).toEqual({ Ath_no: 5001, Last_name: 'De la Cruz', First_name: 'Ana M.', Ath_age: 12 })
    expect(athlete.Last_name).toBe('De la Cruz Pérez')
  })
})
