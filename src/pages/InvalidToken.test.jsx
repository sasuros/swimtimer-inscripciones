import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import InvalidToken, { INVALID_LINK_TEXT } from './InvalidToken'

// v1.19.2: un enlace reemplazado por "Reenviar invitación" caía en "no es válido o ya
// expiró", sin orientar. Texto genérico que cubre ambos casos + contacto global.
describe('pantalla de enlace no válido', () => {
  it('orienta: no válido o reemplazado, revisar el último correo o escribir al organizador', () => {
    const html = renderToStaticMarkup(<InvalidToken whatsapp="584142022123" />)
    expect(INVALID_LINK_TEXT).toBe('Este enlace no es válido o fue reemplazado por uno más reciente. Revisa el último correo de invitación o escríbele al organizador.')
    expect(html).toContain(INVALID_LINK_TEXT)
    expect(html).not.toContain('ya expiró')
  })

  it('con un número real hay WhatsApp y correo globales', () => {
    const html = renderToStaticMarkup(<InvalidToken whatsapp="584142022123" />)
    expect(html).toContain('href="https://wa.me/584142022123?text=')
    expect(html).toContain('href="mailto:albertosuros@yahoo.com?')
  })

  it.each([['vacío', ''], ['relleno', '584120000000']])('WhatsApp %s: sin botón de WhatsApp; el correo queda', (_name, whatsapp) => {
    const html = renderToStaticMarkup(<InvalidToken whatsapp={whatsapp} />)
    expect(html).not.toContain('wa.me')
    expect(html).toContain('href="mailto:albertosuros@yahoo.com?')
  })

  it('sin conexión y sin enlace mantienen su texto, con los mismos botones', () => {
    const offline = renderToStaticMarkup(<InvalidToken networkError whatsapp="584142022123" />)
    expect(offline).toContain('No pudimos conectar')
    expect(offline).not.toContain(INVALID_LINK_TEXT)
    const missing = renderToStaticMarkup(<InvalidToken noToken whatsapp="584142022123" />)
    expect(missing).toContain('Solicita al organizador el enlace único de tu club')
    expect(missing).toContain('Enviar correo')
  })
})
