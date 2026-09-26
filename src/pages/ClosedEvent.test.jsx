import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ClosedEvent from './ClosedEvent'

const event = { name: 'I Copa', status: 'closed', organizer: 'Org', organizer_whatsapp: '' }

// v1.19.2: la tarjeta es blanca; el logo blanco (variante light) quedaba invisible.
describe('pantalla de inscripciones cerradas', () => {
  it('muestra el logo a color, como la de enlace no válido', () => {
    const html = renderToStaticMarkup(<ClosedEvent event={event} />)
    expect(html).toContain('src="/swimtimer-logo.png"')
    expect(html).not.toContain('swimtimer-logo-white.svg')
  })
})

describe('botones de contacto de la pantalla cerrada (v1.19.2)', () => {
  const render = (organizer_whatsapp) => renderToStaticMarkup(<ClosedEvent event={{ ...event, organizer_whatsapp }} />)

  it('con un número real hay WhatsApp y correo', () => {
    const html = render('584142022123')
    expect(html).toContain('href="https://wa.me/584142022123?text=')
    expect(html).toContain('Enviar correo')
  })

  it.each([['vacío', ''], ['relleno', '584120000000'], ['placeholder', '584121234567']])('%s: sin WhatsApp; el correo queda', (_name, value) => {
    const html = render(value)
    expect(html).not.toContain('wa.me')
    expect(html).not.toContain('Contactar por WhatsApp')
    expect(html).toContain('href="mailto:albertosuros@yahoo.com?')
  })
})
