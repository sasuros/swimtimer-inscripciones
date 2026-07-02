import { describe, expect, it } from 'vitest'
import { formatQrEventDate, qrFilename } from './eventQr'

describe('afiche QR de evento', () => {
  it('formatea rangos de fecha en español', () => {
    expect(formatQrEventDate('2026-06-18', '2026-06-19')).toBe('18 y 19 de junio de 2026')
    expect(formatQrEventDate('2026-06-30', '2026-07-01')).toBe('30 de junio y 1 de julio de 2026')
  })

  it('genera un nombre de archivo seguro', () => {
    expect(qrFilename('Copa Portugués 2026')).toBe('QR_Copa_Portugues_2026.png')
  })
})
