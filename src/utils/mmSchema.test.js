import { describe, expect, it } from 'vitest'
import { buildConsolidatedExport } from './mmSchema'

// v1.19.1 (hallazgo de Codex #2): approved_athletes se comparaba sin convertir a número, y un
// nadador aprobado cuyo Ath_no llegaba como string se caía sin aviso del consolidado.
const event = { name: 'Copa', date_start: '2026-12-01', clubs: [{ code: 5, name: 'Club Cinco' }] }
const athlete = (Ath_no, Last_name) => ({ Ath_no, Last_name, First_name: 'Ana', Ath_Sex: 'F', Birth_date: '2012-01-01', Team_no: 5, Ath_age: 14 })
const result = (Ath_no) => ({ Event_ptr: 1, Ath_no, ActualSeed_time: '1:00.00' })
const late = (athletes, approved_athletes) => ({ status: 'partially_approved', athletes, results: athletes.map((item) => result(item.Ath_no)), approved_athletes })

const lateNames = async (submission) => {
  const output = await buildConsolidatedExport({ event, lateInscriptions: [submission], type: 'supplement' })
  return { names: output.athletes.map((item) => item.Last_name), results: output.results.length }
}

describe('consolidado: approved_athletes se compara como número', () => {
  it.each([
    ['IDs aprobados como string, Ath_no numérico', [athlete(5001, 'Uno'), athlete(5002, 'Dos')], ['5001']],
    ['IDs aprobados como número, Ath_no como string', [athlete('5001', 'Uno'), athlete('5002', 'Dos')], [5001]],
    ['ambos como número', [athlete(5001, 'Uno'), athlete(5002, 'Dos')], [5001]],
    ['ambos como string', [athlete('5001', 'Uno'), athlete('5002', 'Dos')], ['5001']]
  ])('%s: entra el aprobado con sus pruebas y el no aprobado queda fuera', async (_name, athletes, approved) => {
    expect(await lateNames(late(athletes, approved))).toEqual({ names: ['Uno'], results: 1 })
  })

  it('sin aprobados no entra ningún nadador tardío', async () => {
    expect(await lateNames(late([athlete(5001, 'Uno')], []))).toEqual({ names: [], results: 0 })
  })
})
