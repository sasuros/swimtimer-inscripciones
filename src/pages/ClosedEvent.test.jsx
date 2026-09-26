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
