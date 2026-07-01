import { describe, expect, it } from 'vitest'
import { createMagicToken, decodeMagicToken, verifyMagicToken } from './magicToken'

describe('enlaces mágicos v3', () => {
  it('firma, normaliza y verifica el correo autorizado', async () => {
    const token = await createMagicToken({ eventId: 'evt-1', clubCode: 6, email: ' Entrenador@Ejemplo.com ' }, 'secreto')
    expect(decodeMagicToken(token)).toMatchObject({ v: 3, e: 'evt-1', c: 6, em: 'entrenador@ejemplo.com' })
    await expect(verifyMagicToken(token, 'secreto')).resolves.toMatchObject({ e: 'evt-1', c: 6 })
    await expect(verifyMagicToken(token, 'otra-clave')).resolves.toBeNull()
  })
})
